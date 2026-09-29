-- Retrieval quality: add a similarity floor, and a variant that reuses an
-- entry's already-stored embedding instead of re-embedding its text.
--
-- The 3-argument match_entries is replaced (dropped) rather than overloaded, so
-- PostgREST named-argument calls never become ambiguous. The new parameter has a
-- default that filters nothing, so callers written for the old signature keep
-- working: apply this migration first, then deploy the code that uses it.
--
-- Rollback (manual): drop both functions and recreate match_entries(vector, int,
-- uuid) from the baseline migration.

drop function if exists public.match_entries(vector, int, uuid);

-- SECURITY INVOKER (default): RLS still restricts matches to the caller's rows.
create or replace function public.match_entries (
  query_embedding vector(1536),
  match_count int default 4,
  exclude_id uuid default null,
  min_similarity float default -1
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
    and 1 - (e.embedding <=> query_embedding) >= min_similarity
  order by e.embedding <=> query_embedding
  limit match_count;
$$;

-- Same search, seeded from a stored entry's embedding. The seed entry is read
-- under RLS too, so passing another user's entry id simply returns no rows.
create or replace function public.match_entries_for_entry (
  p_entry_id uuid,
  match_count int default 4,
  min_similarity float default -1
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
    1 - (e.embedding <=> src.embedding) as similarity
  from public.entries e
  cross join (
    select s.embedding from public.entries s where s.id = p_entry_id
  ) src
  where src.embedding is not null
    and e.embedding is not null
    and e.id <> p_entry_id
    and 1 - (e.embedding <=> src.embedding) >= min_similarity
  order by e.embedding <=> src.embedding
  limit match_count;
$$;

revoke all on function public.match_entries_for_entry(uuid, int, float) from public, anon;
grant execute on function public.match_entries_for_entry(uuid, int, float) to authenticated;
