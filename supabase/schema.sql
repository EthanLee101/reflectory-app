-- Journal Buddy — database schema
-- Run this in the Supabase SQL editor (or via the CLI) to set up the MVP.
-- Assumes Supabase Auth is enabled (auth.users exists).

-- 1. Extensions ------------------------------------------------------------
-- pgvector for embedding storage + similarity search.
create extension if not exists vector;

-- 2. Entries table ---------------------------------------------------------
-- NOTE: embedding dimension (1536) must match OPENAI_EMBEDDING_DIM /
-- OPENAI_EMBEDDING_MODEL (text-embedding-3-small = 1536).
create table if not exists public.entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  content text not null,
  embedding vector(1536),
  -- Short, LLM-extracted theme tags (e.g. "work stress", "gratitude").
  -- Best-effort: extraction failure leaves this empty rather than blocking a save.
  themes text[] not null default '{}',
  created_at timestamptz not null default now()
);

-- Existing databases: add the column if it predates this migration.
alter table public.entries add column if not exists themes text[] not null default '{}';

create index if not exists entries_user_id_created_at_idx
  on public.entries (user_id, created_at desc);

-- Approximate nearest-neighbor index for cosine similarity.
-- (For MVP data volumes an exact scan is fine; this keeps it fast as data grows.)
create index if not exists entries_embedding_idx
  on public.entries
  using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);

-- 3. Row-Level Security ----------------------------------------------------
-- Grants first — RLS only narrows rows within privileges a role already has.
grant select, insert, update, delete on public.entries to authenticated;

-- The core privacy guarantee: a user can only ever see/modify their own rows.
alter table public.entries enable row level security;

drop policy if exists "Users can read their own entries" on public.entries;
create policy "Users can read their own entries"
  on public.entries for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert their own entries" on public.entries;
create policy "Users can insert their own entries"
  on public.entries for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update their own entries" on public.entries;
create policy "Users can update their own entries"
  on public.entries for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete their own entries" on public.entries;
create policy "Users can delete their own entries"
  on public.entries for delete
  using (auth.uid() = user_id);

-- 4. Similarity search RPC -------------------------------------------------
-- Returns the caller's most similar past entries. SECURITY INVOKER (default)
-- means RLS still applies — a user can only ever match their own rows.
create or replace function public.match_entries (
  query_embedding vector(1536),
  match_count int default 4,
  exclude_id uuid default null
)
returns table (
  id uuid,
  content text,
  created_at timestamptz,
  similarity float
)
language sql
stable
as $$
  select
    e.id,
    e.content,
    e.created_at,
    1 - (e.embedding <=> query_embedding) as similarity
  from public.entries e
  where e.embedding is not null
    and (exclude_id is null or e.id <> exclude_id)
  order by e.embedding <=> query_embedding
  limit match_count;
$$;

-- 5. Rate limiting -----------------------------------------------------
-- Postgres-backed so limits are correct across concurrent serverless
-- instances/cold starts (an in-memory counter would not be a real global
-- limit). NOTE: this is a new section added after the MVP — re-run this
-- whole file (or just this section) in the Supabase SQL editor; there is
-- no migrations pipeline for this project.
create table if not exists public.rate_limits (
  user_id uuid not null references auth.users (id) on delete cascade,
  route text not null,
  window_start timestamptz not null default now(),
  count int not null default 0,
  primary key (user_id, route)
);

grant select, insert, update, delete on public.rate_limits to authenticated;

alter table public.rate_limits enable row level security;

drop policy if exists "Users can manage their own rate limit bucket" on public.rate_limits;
create policy "Users can manage their own rate limit bucket"
  on public.rate_limits for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Atomic check-and-increment: a single INSERT ... ON CONFLICT is row-locked,
-- so concurrent requests from the same user can't race past the limit.
-- SECURITY INVOKER (the default) for consistency with match_entries, though
-- bypass isn't a real security concern here since the function only ever
-- touches the caller's own bucket via auth.uid().
create or replace function public.check_rate_limit (
  p_route text,
  p_limit int,
  p_window_seconds int
)
returns boolean
language plpgsql
as $$
declare
  v_count int;
begin
  insert into public.rate_limits as rl (user_id, route, window_start, count)
  values (auth.uid(), p_route, now(), 1)
  on conflict (user_id, route) do update
    set count = case
          when rl.window_start < now() - (p_window_seconds || ' seconds')::interval
            then 1
          else rl.count + 1
        end,
        window_start = case
          when rl.window_start < now() - (p_window_seconds || ' seconds')::interval
            then now()
          else rl.window_start
        end
  returning count into v_count;

  return v_count <= p_limit;
end;
$$;

-- 6. Reflection history ------------------------------------------------
-- Persists each generated reflection (and the grounding it used) so past
-- reflections survive a page reload and can be revisited. Best-effort from
-- the app's side: a write failure here never blocks returning the
-- reflection to the user. NOTE: new section — re-run in the SQL editor.
create table if not exists public.reflections (
  id uuid primary key default gen_random_uuid(),
  entry_id uuid not null references public.entries (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  content text not null,
  -- Snapshot of the RetrievedEntry[] grounding used for this reflection.
  grounding jsonb not null default '[]',
  crisis_triggered boolean not null default false,
  crisis_source text,
  created_at timestamptz not null default now()
);

create index if not exists reflections_entry_id_created_at_idx
  on public.reflections (entry_id, created_at desc);

grant select, insert on public.reflections to authenticated;

alter table public.reflections enable row level security;

drop policy if exists "Users can read their own reflections" on public.reflections;
create policy "Users can read their own reflections"
  on public.reflections for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert their own reflections" on public.reflections;
create policy "Users can insert their own reflections"
  on public.reflections for insert
  with check (auth.uid() = user_id);
