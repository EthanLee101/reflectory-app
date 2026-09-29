import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { asAnon, asUser, closePool, createUser, getPool, resetDatabase } from "./helpers";

let user: string;

beforeAll(async () => {
  await resetDatabase();
  user = await createUser();
});

afterAll(closePool);

const check = (userId: string, route: string, limit: number, windowSeconds = 300) =>
  asUser(userId, async (c) => {
    const { rows } = await c.query("select check_rate_limit($1, $2, $3) as ok", [
      route,
      limit,
      windowSeconds,
    ]);
    return rows[0].ok as boolean;
  });

describe("check_rate_limit", () => {
  it("admits exactly `limit` requests under 30 concurrent connections", async () => {
    const results = await Promise.all(
      Array.from({ length: 30 }, () => check(user, "reflect", 20))
    );
    expect(results.filter(Boolean)).toHaveLength(20);
    expect(results.filter((ok) => !ok)).toHaveLength(10);
  });

  it("keeps buckets separate per user and per route", async () => {
    const other = await createUser();
    expect(await check(other, "reflect", 1)).toBe(true);
    expect(await check(user, "search", 1)).toBe(true);
    expect(await check(other, "reflect", 1)).toBe(false);
  });

  it("starts a fresh window once the old one has expired", async () => {
    const fresh = await createUser();
    expect(await check(fresh, "search", 1)).toBe(true);
    expect(await check(fresh, "search", 1)).toBe(false);
    await getPool().query(
      "update rate_limits set window_start = now() - interval '10 minutes' where user_id = $1",
      [fresh]
    );
    expect(await check(fresh, "search", 1)).toBe(true);
  });
});

describe("rate_limits lockdown", () => {
  it("does not let a user read, reset or edit their own bucket directly", async () => {
    const victim = await createUser();
    await check(victim, "reflect", 1);
    await expect(
      asUser(victim, (c) => c.query("delete from rate_limits where user_id = $1", [victim]))
    ).rejects.toThrow(/permission denied/);
    await expect(
      asUser(victim, (c) => c.query("update rate_limits set count = 0 where user_id = $1", [victim]))
    ).rejects.toThrow(/permission denied/);
    await expect(
      asUser(victim, (c) => c.query("select * from rate_limits"))
    ).rejects.toThrow(/permission denied/);
  });

  it("still counts correctly after the lockdown", async () => {
    const u = await createUser();
    expect(await check(u, "reflect", 1)).toBe(true);
    expect(await check(u, "reflect", 1)).toBe(false);
  });

  it("denies requests with no authenticated user", async () => {
    const client = await getPool().connect();
    try {
      await client.query("begin");
      await client.query("set local role authenticated");
      const { rows } = await client.query("select check_rate_limit('reflect', 5, 300) as ok");
      expect(rows[0].ok).toBe(false);
      await client.query("rollback");
    } finally {
      client.release();
    }
  });

  it("does not let anon call the limiter", async () => {
    await expect(
      asAnon((c) => c.query("select check_rate_limit('reflect', 5, 300)"))
    ).rejects.toThrow(/permission denied/);
  });

  it("does not let API roles run the cleanup function", async () => {
    const u = await createUser();
    await expect(
      asUser(u, (c) => c.query("select cleanup_expired_bookkeeping()"))
    ).rejects.toThrow(/permission denied/);
  });

  it("cleanup removes only expired rows", async () => {
    const u = await createUser();
    await getPool().query(
      "insert into rate_limits (user_id, route, window_start, count) values ($1,'old', now() - interval '2 days', 1), ($1,'new', now(), 1)",
      [u]
    );
    await getPool().query("select cleanup_expired_bookkeeping()");
    const { rows } = await getPool().query("select route from rate_limits where user_id = $1", [u]);
    expect(rows.map((r) => r.route)).toEqual(["new"]);
  });
});
