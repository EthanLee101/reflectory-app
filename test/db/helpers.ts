import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { Pool, type PoolClient } from "pg";

/**
 * Real-Postgres test harness. Applies every file in supabase/migrations/ to a
 * scratch database and exposes helpers to run SQL "as" a Supabase user.
 *
 * This exercises the real RLS policies, grants and SQL functions. It does NOT
 * exercise PostgREST or GoTrue (Supabase's HTTP and auth layers), so the
 * manual two-account check in the README remains the end-to-end confirmation.
 */

const MIGRATIONS_DIR = join(process.cwd(), "supabase", "migrations");

export const EMBEDDING_DIM = 1536;

// Minimal stand-in for what Supabase provides before our migrations run:
// the anon/authenticated roles, auth.users, and auth.uid() (which reads the
// JWT claims PostgREST sets on each request).
const SUPABASE_STANDIN = `
  do $$ begin
    if not exists (select 1 from pg_roles where rolname = 'anon') then
      create role anon nologin;
    end if;
    if not exists (select 1 from pg_roles where rolname = 'authenticated') then
      create role authenticated nologin;
    end if;
  end $$;

  create schema auth;
  create table auth.users (id uuid primary key);
  create function auth.uid() returns uuid language sql stable as $$
    select nullif(
      coalesce(
        current_setting('request.jwt.claim.sub', true),
        (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
      ),
      ''
    )::uuid
  $$;
  grant usage on schema auth to anon, authenticated;
  grant execute on function auth.uid() to anon, authenticated;
  grant usage on schema public to anon, authenticated;
`;

let pool: Pool | null = null;

export function getPool(): Pool {
  const url = process.env.TEST_DATABASE_URL;
  if (!url) {
    throw new Error(
      "TEST_DATABASE_URL is not set. Start a pgvector Postgres (see README, 'Database tests')."
    );
  }
  pool ??= new Pool({ connectionString: url, max: 40 });
  return pool;
}

export async function closePool() {
  await pool?.end();
  pool = null;
}

/** Drops everything and re-applies the stand-in plus all migrations, in filename order. */
export async function resetDatabase() {
  const client = await getPool().connect();
  try {
    await client.query("drop schema if exists public cascade; create schema public;");
    await client.query("drop schema if exists auth cascade;");
    await client.query(SUPABASE_STANDIN);
    const files = readdirSync(MIGRATIONS_DIR)
      .filter((f) => f.endsWith(".sql"))
      .sort();
    for (const file of files) {
      try {
        await client.query(readFileSync(join(MIGRATIONS_DIR, file), "utf8"));
      } catch (err) {
        throw new Error(`Migration ${file} failed: ${(err as Error).message}`);
      }
    }
  } finally {
    client.release();
  }
}

export async function createUser(): Promise<string> {
  const { rows } = await getPool().query(
    "insert into auth.users (id) values (gen_random_uuid()) returning id"
  );
  return rows[0].id;
}

/** Runs `fn` in a transaction as the `authenticated` role with the given user's JWT sub. */
export async function asUser<T>(
  userId: string,
  fn: (client: PoolClient) => Promise<T>,
  { commit = true }: { commit?: boolean } = {}
): Promise<T> {
  const client = await getPool().connect();
  try {
    await client.query("begin");
    await client.query("set local role authenticated");
    await client.query("select set_config('request.jwt.claims', $1, true)", [
      JSON.stringify({ sub: userId, role: "authenticated" }),
    ]);
    const result = await fn(client);
    await client.query(commit ? "commit" : "rollback");
    return result;
  } catch (err) {
    await client.query("rollback").catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

/** Runs `fn` as the unauthenticated `anon` role (no JWT). */
export async function asAnon<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await getPool().connect();
  try {
    await client.query("begin");
    await client.query("set local role anon");
    const result = await fn(client);
    await client.query("rollback");
    return result;
  } catch (err) {
    await client.query("rollback").catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

/** pgvector literal: a unit vector along `axis`, optionally blended with `otherAxis`. */
export function vec(axis: number, otherAxis?: number, otherWeight = 0): string {
  const v = new Array<number>(EMBEDDING_DIM).fill(0);
  v[axis] = 1 - otherWeight;
  if (otherAxis !== undefined) v[otherAxis] = otherWeight;
  return `[${v.join(",")}]`;
}
