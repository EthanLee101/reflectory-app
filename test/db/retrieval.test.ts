import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { asUser, closePool, createUser, resetDatabase, vec } from "./helpers";

let alice: string;
let bob: string;
const ids: Record<string, string> = {};

beforeAll(async () => {
  await resetDatabase();
  alice = await createUser();
  bob = await createUser();
  await asUser(alice, async (c) => {
    // Cosine similarity to `seed` (axis 0): same = 1, blend = ~0.707, orthogonal = 0.
    for (const [name, embedding] of [
      ["seed", vec(0)],
      ["near", vec(0)],
      ["related", vec(0, 1, 0.5)],
      ["unrelated", vec(2)],
    ] as const) {
      const { rows } = await c.query(
        "insert into entries (content, embedding) values ($1, $2) returning id",
        [name, embedding]
      );
      ids[name] = rows[0].id;
    }
  });
  await asUser(bob, (c) =>
    c.query("insert into entries (content, embedding) values ('bob', $1)", [vec(0)])
  );
});

afterAll(closePool);

const contents = (rows: { content: string }[]) => rows.map((r) => r.content);

describe("match_entries min_similarity", () => {
  it("returns everything when no floor is given (old-signature callers)", async () => {
    const { rows } = await asUser(alice, (c) =>
      c.query("select content from match_entries($1::vector, 10, $2)", [vec(0), ids.seed])
    );
    expect(contents(rows)).toEqual(["near", "related", "unrelated"]);
  });

  it("drops matches below the floor", async () => {
    const { rows } = await asUser(alice, (c) =>
      c.query("select content from match_entries($1::vector, 10, $2, 0.5)", [vec(0), ids.seed])
    );
    expect(contents(rows)).toEqual(["near", "related"]);
    const strict = await asUser(alice, (c) =>
      c.query("select content from match_entries($1::vector, 10, $2, 0.9)", [vec(0), ids.seed])
    );
    expect(contents(strict.rows)).toEqual(["near"]);
  });
});

describe("match_entries_for_entry", () => {
  it("matches using the stored embedding and excludes the entry itself", async () => {
    const { rows } = await asUser(alice, (c) =>
      c.query("select content, similarity from match_entries_for_entry($1, 10, 0.5)", [ids.seed])
    );
    expect(contents(rows)).toEqual(["near", "related"]);
    expect(rows[0].similarity).toBeCloseTo(1, 5);
    expect(rows[1].similarity).toBeCloseTo(Math.SQRT1_2, 3);
  });

  it("returns nothing for another user's entry id", async () => {
    const { rows } = await asUser(bob, (c) =>
      c.query("select content from match_entries_for_entry($1, 10)", [ids.seed])
    );
    expect(rows).toHaveLength(0);
  });

  it("never returns another user's entries", async () => {
    const { rows } = await asUser(alice, (c) =>
      c.query("select content from match_entries_for_entry($1, 10)", [ids.seed])
    );
    expect(contents(rows)).not.toContain("bob");
  });
});
