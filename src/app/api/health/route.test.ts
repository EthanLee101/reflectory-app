import { describe, it, expect, vi, beforeEach } from "vitest";

function makeBuilder(result: { error: unknown }) {
  const builder: Record<string, unknown> = {
    select: vi.fn(() => builder),
    limit: vi.fn(() => Promise.resolve(result)),
  };
  return builder;
}

const { fromMock, createClientMock } = vi.hoisted(() => ({
  fromMock: vi.fn(),
  createClientMock: vi.fn(),
}));

createClientMock.mockImplementation(() => Promise.resolve({ from: fromMock }));
vi.mock("@/lib/supabase/server", () => ({ createClient: createClientMock }));

import { GET } from "@/app/api/health/route";

beforeEach(() => {
  fromMock.mockReset();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("GET /api/health", () => {
  it("returns ok when the DB round-trip succeeds", async () => {
    fromMock.mockReturnValue(makeBuilder({ error: null }));
    const res = await GET();
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json).toEqual({ status: "ok" });
  });

  it("returns error when the DB round-trip fails", async () => {
    fromMock.mockReturnValue(makeBuilder({ error: { message: "db unreachable" } }));
    const res = await GET();
    const json = await res.json();
    expect(res.status).toBe(500);
    expect(json).toEqual({ status: "error" });
  });
});
