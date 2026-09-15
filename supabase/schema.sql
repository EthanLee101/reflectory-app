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
  created_at timestamptz not null default now()
);

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
