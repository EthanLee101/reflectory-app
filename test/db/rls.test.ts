import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { asAnon, asUser, closePool, createUser, resetDatabase, vec } from "./helpers";

let alice: string;
let bob: string;
let aliceEntryId: string;

beforeAll(async () => {
  await resetDatabase();
  alice = await createUser();
  bob = await createUser();
  aliceEntryId = await asUser(alice, async (c) => {
    const { rows } = await c.query(
      "insert into entries (content, embedding) values ('alice private entry', $1) returning id",
      [vec(0)]
    );
    await c.query(
      "insert into entries (content, embedding) values ('alice second entry', $1)",
      [vec(1)]
    );
    return rows[0].id;
  });
});

afterAll(closePool);

describe("entries RLS", () => {
  it("defaults user_id to the caller", async () => {
    const { rows } = await asUser(alice, (c) =>
      c.query("select user_id from entries where id = $1", [aliceEntryId])
    );
    expect(rows[0].user_id).toBe(alice);
  });

  it("hides another user's entries from select", async () => {
    const { rows } = await asUser(bob, (c) => c.query("select id from entries"));
    expect(rows).toHaveLength(0);
  });

  it("does not let another user update an entry", async () => {
    const res = await asUser(bob, (c) =>
      c.query("update entries set content = 'hacked' where id = $1", [aliceEntryId])
    );
    expect(res.rowCount).toBe(0);
    const { rows } = await asUser(alice, (c) =>
      c.query("select content from entries where id = $1", [aliceEntryId])
    );
    expect(rows[0].content).toBe("alice private entry");
  });

  it("does not let another user delete an entry", async () => {
    const res = await asUser(bob, (c) =>
      c.query("delete from entries where id = $1", [aliceEntryId])
    );
    expect(res.rowCount).toBe(0);
  });

  it("rejects inserting a row owned by someone else", async () => {
    await expect(
      asUser(bob, (c) =>
        c.query("insert into entries (user_id, content) values ($1, 'spoofed')", [alice])
      )
    ).rejects.toThrow(/row-level security/);
  });

  it("rejects reassigning an owned row to someone else", async () => {
    await expect(
      asUser(alice, (c) =>
        c.query("update entries set user_id = $1 where id = $2", [bob, aliceEntryId])
      )
    ).rejects.toThrow(/row-level security/);
  });

  it("shows anonymous callers zero rows and blocks anonymous writes", async () => {
    const { rows } = await asAnon((c) => c.query("select id from entries"));
    expect(rows).toHaveLength(0);
    await expect(
      asAnon((c) => c.query("insert into entries (content) values ('anon')"))
    ).rejects.toThrow(/permission denied/);
  });
});

describe("match_entries", () => {
  it("only matches the caller's own entries", async () => {
    await asUser(bob, (c) =>
      c.query("insert into entries (content, embedding) values ('bob entry', $1)", [vec(0)])
    );
    const alicesMatches = await asUser(alice, (c) =>
      c.query("select content from match_entries($1::vector, 10)", [vec(0)])
    );
    expect(alicesMatches.rows.map((r) => r.content).sort()).toEqual([
      "alice private entry",
      "alice second entry",
    ]);
    const bobsMatches = await asUser(bob, (c) =>
      c.query("select content from match_entries($1::vector, 10)", [vec(0)])
    );
    expect(bobsMatches.rows.map((r) => r.content)).toEqual(["bob entry"]);
  });

  it("excludes the given entry id", async () => {
    const { rows } = await asUser(alice, (c) =>
      c.query("select id from match_entries($1::vector, 10, $2)", [vec(0), aliceEntryId])
    );
    expect(rows.map((r) => r.id)).not.toContain(aliceEntryId);
  });
});

describe("reflections RLS", () => {
  it("hides one user's reflections from another", async () => {
    await asUser(alice, (c) =>
      c.query("insert into reflections (entry_id, content) values ($1, 'for alice')", [aliceEntryId])
    );
    const { rows } = await asUser(bob, (c) => c.query("select id from reflections"));
    expect(rows).toHaveLength(0);
  });

  it("rejects attaching a reflection to someone else's entry", async () => {
    await expect(
      asUser(bob, (c) =>
        c.query("insert into reflections (entry_id, content) values ($1, 'sneaky')", [aliceEntryId])
      )
    ).rejects.toThrow(/row-level security/);
  });

  it("rejects a reflection owned by someone else", async () => {
    await expect(
      asUser(bob, (c) =>
        c.query("insert into reflections (entry_id, user_id, content) values ($1, $2, 'spoof')", [
          aliceEntryId,
          alice,
        ])
      )
    ).rejects.toThrow(/row-level security/);
  });
});
