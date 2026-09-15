import { describe, it, expect, vi, beforeEach } from "vitest";
import { MAX_ENTRY_LENGTH } from "@/lib/constants";

function makeBuilder(result: { data: unknown; error: unknown }) {
  const builder: Record<string, unknown> = {
    select: vi.fn(() => builder),
    order: vi.fn(() => builder),
    insert: vi.fn(() => builder),
    single: vi.fn(() => Promise.resolve(result)),
    then: (
      resolve: (v: typeof result) => unknown,
      reject: (e: unknown) => unknown
    ) => Promise.resolve(result).then(resolve, reject),
  };
  return builder;
}

const {
  getUserMock,
  createClientMock,
  fromMock,
  embedMock,
  detectCrisisMock,
  checkRateLimitMock,
} = vi.hoisted(() => ({
  getUserMock: vi.fn(),
  createClientMock: vi.fn(),
  fromMock: vi.fn(),
  embedMock: vi.fn(),
  detectCrisisMock: vi.fn(),
  checkRateLimitMock: vi.fn(),
}));

createClientMock.mockImplementation(() =>
  Promise.resolve({ auth: { getUser: getUserMock }, from: fromMock })
);

vi.mock("@/lib/supabase/server", () => ({ createClient: createClientMock }));
vi.mock("@/lib/embeddings", () => ({ embed: embedMock }));
vi.mock("@/lib/crisis", () => ({ detectCrisis: detectCrisisMock }));
vi.mock("@/lib/rate-limit", () => ({ checkRateLimit: checkRateLimitMock }));

import { GET, POST } from "@/app/api/entries/route";

function makeRequest(body: unknown) {
  return new Request("http://localhost/api/entries", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

beforeEach(() => {
  getUserMock.mockReset().mockResolvedValue({ data: { user: { id: "u1" } } });
  fromMock.mockReset();
  embedMock.mockReset();
  detectCrisisMock.mockReset();
  checkRateLimitMock.mockReset().mockResolvedValue(true);
});

describe("GET /api/entries", () => {
  it("returns 401 when there is no authenticated user", async () => {
    getUserMock.mockResolvedValue({ data: { user: null } });
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("returns the caller's entries", async () => {
    const entries = [{ id: "e1", user_id: "u1", content: "hi", created_at: "2026-01-01" }];
    fromMock.mockReturnValue(makeBuilder({ data: entries, error: null }));
    const res = await GET();
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.entries).toEqual(entries);
  });
});

describe("POST /api/entries", () => {
  it("returns 401 when there is no authenticated user", async () => {
    getUserMock.mockResolvedValue({ data: { user: null } });
    const res = await POST(makeRequest({ content: "hello" }));
    expect(res.status).toBe(401);
    expect(checkRateLimitMock).not.toHaveBeenCalled();
  });

  it("returns 429 when rate limited, without embedding or crisis-checking", async () => {
    checkRateLimitMock.mockResolvedValue(false);
    const res = await POST(makeRequest({ content: "hello" }));
    expect(res.status).toBe(429);
    expect(embedMock).not.toHaveBeenCalled();
    expect(detectCrisisMock).not.toHaveBeenCalled();
  });

  it("returns 400 for empty content", async () => {
    const res = await POST(makeRequest({ content: "   " }));
    expect(res.status).toBe(400);
  });

  it("returns 400 for content over the max length", async () => {
    const res = await POST(makeRequest({ content: "a".repeat(MAX_ENTRY_LENGTH + 1) }));
    expect(res.status).toBe(400);
  });

  it("returns 502 when embedding fails", async () => {
    embedMock.mockRejectedValue(new Error("embedding service down"));
    detectCrisisMock.mockResolvedValue({ triggered: false, source: "none" });
    const res = await POST(makeRequest({ content: "hello" }));
    const json = await res.json();
    expect(res.status).toBe(502);
    expect(json.error).toBe("embedding service down");
  });

  it("creates the entry on success", async () => {
    embedMock.mockResolvedValue([0.1, 0.2]);
    detectCrisisMock.mockResolvedValue({ triggered: false, source: "none" });
    const entry = { id: "e1", user_id: "u1", content: "hello", created_at: "2026-01-01" };
    fromMock.mockReturnValue(makeBuilder({ data: entry, error: null }));

    const res = await POST(makeRequest({ content: "hello" }));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.entry).toEqual(entry);
    expect(json.crisis).toEqual({ triggered: false, source: "none" });
  });
});
