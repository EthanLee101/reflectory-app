-- Lock down the rate limiter, tighten reflections ownership, and add cleanup.
--
-- Problem: rate_limits was directly writable by `authenticated`, so any signed-in
-- user holding the public publishable key could DELETE their own bucket row via
-- the REST API and reset their counter. The counter must only ever change
-- through check_rate_limit().
--
-- Rollback (manual): re-grant `select, insert, update, delete on public.rate_limits
-- to authenticated`, recreate the "Users can manage their own rate limit bucket"
-- policy from the baseline, and recreate check_rate_limit without SECURITY DEFINER.

-- 1. rate_limits: no direct access for API roles ---------------------------
drop policy if exists "Users can manage their own rate limit bucket" on public.rate_limits;
revoke all on public.rate_limits from authenticated, anon;

-- 2. check_rate_limit runs as its owner so it can write the locked table ----
-- auth.uid() still reflects the caller's JWT inside SECURITY DEFINER, so a user
-- can only ever touch their own bucket. search_path is pinned to avoid
-- search-path hijacking of a definer function.
create or replace function public.check_rate_limit (
  p_route text,
  p_limit int,
  p_window_seconds int
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_count int;
begin
  if v_uid is null then
    return false;
  end if;

  insert into public.rate_limits as rl (user_id, route, window_start, count)
  values (v_uid, p_route, now(), 1)
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

revoke all on function public.check_rate_limit(text, int, int) from public, anon;
grant execute on function public.check_rate_limit(text, int, int) to authenticated;

-- 3. reflections: the entry must belong to the caller ----------------------
-- The baseline policy only checked user_id, and FK checks bypass RLS, so a
-- user could attach a reflection row to someone else's entry id.
drop policy if exists "Users can insert their own reflections" on public.reflections;
create policy "Users can insert their own reflections"
  on public.reflections for insert
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.entries e
      where e.id = entry_id and e.user_id = auth.uid()
    )
  );

-- 4. Cleanup of expired bookkeeping rows -----------------------------------
-- Rate-limit windows are minutes long and idempotency keys have a 5 minute
-- replay TTL, so anything older than a day is dead weight. Uses pg_cron when
-- available; if the extension is not enabled on this project the migration
-- still applies and cleanup must be enabled from the Supabase dashboard
-- (Database -> Extensions -> pg_cron), then this block re-run.
create or replace function public.cleanup_expired_bookkeeping ()
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.idempotency_keys where created_at < now() - interval '1 day';
  delete from public.rate_limits where window_start < now() - interval '1 day';
$$;

revoke all on function public.cleanup_expired_bookkeeping() from public, anon, authenticated;

do $$
begin
  create extension if not exists pg_cron;
  perform cron.schedule(
    'cleanup-expired-bookkeeping',
    '17 3 * * *',
    'select public.cleanup_expired_bookkeeping()'
  );
exception when others then
  raise notice 'pg_cron unavailable (%); expired-row cleanup not scheduled', sqlerrm;
end $$;
