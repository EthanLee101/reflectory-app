import { describe, it, expect, vi, beforeEach } from "vitest";

function makeBuilder(result: { data: unknown; error: unknown }) {
  const builder: Record<string, unknown> = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    order: vi.fn(() => Promise.resolve(result)),
  };
  return builder;
}

const { getUserMock, createClientMock, fromMock } = vi.hoisted(() => ({
  getUserMock: vi.fn(),
  createClientMock: vi.fn(),
  fromMock: vi.fn(),
}));

createClientMock.mockImplementation(() =>
  Promise.resolve({ auth: { getUser: getUserMock }, from: fromMock })
);

vi.mock("@/lib/supabase/server", () => ({ createClient: createClientMock }));

import { GET } from "@/app/api/entries/[id]/reflections/route";

function ctx(id = "e1") {
  return { params: Promise.resolve({ id }) };
}

beforeEach(() => {
  getUserMock.mockReset().mockResolvedValue({ data: { user: { id: "u1" } } });
  fromMock.mockReset();
});

describe("GET /api/entries/[id]/reflections", () => {
  it("returns 401 when there is no authenticated user", async () => {
    getUserMock.mockResolvedValue({ data: { user: null } });
    const res = await GET(new Request("http://localhost"), ctx());
    expect(res.status).toBe(401);
  });

  it("returns 500 on a query error", async () => {
    fromMock.mockReturnValue(
      makeBuilder({ data: null, error: { message: "db down" } })
    );
    const res = await GET(new Request("http://localhost"), ctx());
    const json = await res.json();
    expect(res.status).toBe(500);
    expect(json.error).toBe("Failed to load reflections");
  });

  it("maps stored rows into the Reflection shape", async () => {
    const row = {
      id: "r1",
      entry_id: "e1",
      content: "a warm reflection",
      grounding: [{ id: "e0", content: "past", created_at: "2026-01-01", similarity: 0.7 }],
      crisis_triggered: false,
      crisis_source: "none",
      created_at: "2026-02-01",
    };
    fromMock.mockReturnValue(makeBuilder({ data: [row], error: null }));

    const res = await GET(new Request("http://localhost"), ctx());
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.reflections).toEqual([
      {
        id: "r1",
        entry_id: "e1",
        content: "a warm reflection",
        grounding: row.grounding,
        crisis: { triggered: false, source: "none" },
        created_at: "2026-02-01",
      },
    ]);
  });
});
