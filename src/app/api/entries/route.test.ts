import { describe, it, expect, vi, beforeEach } from "vitest";
import { MAX_ENTRY_LENGTH } from "@/lib/constants";

function makeBuilder(result: { data: unknown; error: unknown }) {
  const builder: Record<string, unknown> = {
    select: vi.fn(() => builder),
    order: vi.fn(() => builder),
    limit: vi.fn(() => builder),
    lt: vi.fn(() => builder),
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
  extractThemesMock,
  checkRateLimitMock,
  claimIdempotencyKeyMock,
  completeIdempotencyKeyMock,
  releaseIdempotencyKeyMock,
} = vi.hoisted(() => ({
  getUserMock: vi.fn(),
  createClientMock: vi.fn(),
  fromMock: vi.fn(),
  embedMock: vi.fn(),
  detectCrisisMock: vi.fn(),
  extractThemesMock: vi.fn(),
  checkRateLimitMock: vi.fn(),
  claimIdempotencyKeyMock: vi.fn(),
  completeIdempotencyKeyMock: vi.fn(),
  releaseIdempotencyKeyMock: vi.fn(),
}));

createClientMock.mockImplementation(() =>
  Promise.resolve({ auth: { getUser: getUserMock }, from: fromMock })
);

vi.mock("@/lib/supabase/server", () => ({ createClient: createClientMock }));
vi.mock("@/lib/embeddings", () => ({ embed: embedMock }));
vi.mock("@/lib/crisis", () => ({ detectCrisis: detectCrisisMock }));
vi.mock("@/lib/themes", () => ({ extractThemes: extractThemesMock }));
vi.mock("@/lib/rate-limit", () => ({ checkRateLimit: checkRateLimitMock }));
vi.mock("@/lib/idempotency", () => ({
  claimIdempotencyKey: claimIdempotencyKeyMock,
  completeIdempotencyKey: completeIdempotencyKeyMock,
  releaseIdempotencyKey: releaseIdempotencyKeyMock,
}));

import { GET, POST } from "@/app/api/entries/route";

function makeRequest(body: unknown, headers: Record<string, string> = {}) {
  return new Request("http://localhost/api/entries", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json", ...headers },
  });
}

function makeGetRequest(query = "") {
  return new Request(`http://localhost/api/entries${query}`);
}

beforeEach(() => {
  getUserMock.mockReset().mockResolvedValue({ data: { user: { id: "u1" } } });
  fromMock.mockReset();
  embedMock.mockReset();
  detectCrisisMock.mockReset();
  extractThemesMock.mockReset().mockResolvedValue([]);
  checkRateLimitMock.mockReset().mockResolvedValue(true);
  claimIdempotencyKeyMock.mockReset().mockResolvedValue({ replay: false });
  completeIdempotencyKeyMock.mockReset().mockResolvedValue(undefined);
  releaseIdempotencyKeyMock.mockReset().mockResolvedValue(undefined);
});

describe("GET /api/entries", () => {
  it("returns 401 when there is no authenticated user", async () => {
    getUserMock.mockResolvedValue({ data: { user: null } });
    const res = await GET(makeGetRequest());
    expect(res.status).toBe(401);
  });

  it("returns the caller's entries", async () => {
    const entries = [{ id: "e1", user_id: "u1", content: "hi", created_at: "2026-01-01" }];
    fromMock.mockReturnValue(makeBuilder({ data: entries, error: null }));
    const res = await GET(makeGetRequest());
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.entries).toEqual(entries);
    expect(json.nextCursor).toBeNull();
  });

  it("sets nextCursor to the last kept row's created_at when more rows exist than the limit", async () => {
    // limit defaults to ENTRIES_PAGE_SIZE (20); return 21 rows to simulate "more available".
    const page = Array.from({ length: 21 }, (_, i) => ({
      id: `e${i}`,
      user_id: "u1",
      content: "hi",
      created_at: `2026-01-${String(21 - i).padStart(2, "0")}`,
    }));
    fromMock.mockReturnValue(makeBuilder({ data: page, error: null }));

    const res = await GET(makeGetRequest());
    const json = await res.json();

    expect(json.entries).toHaveLength(20);
    expect(json.nextCursor).toBe(page[19].created_at);
  });

  it("passes the cursor query param through as a .lt('created_at', cursor) filter", async () => {
    const builder = makeBuilder({ data: [], error: null });
    fromMock.mockReturnValue(builder);

    await GET(makeGetRequest("?cursor=2026-01-01"));

    expect(builder.lt).toHaveBeenCalledWith("created_at", "2026-01-01");
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
    expect(json.error).toBe("Failed to process entry");
  });

  it("returns 504 when embedding times out", async () => {
    const timeoutErr = new Error("The operation was aborted");
    timeoutErr.name = "TimeoutError";
    embedMock.mockRejectedValue(timeoutErr);
    detectCrisisMock.mockResolvedValue({ triggered: false, source: "none" });
    const res = await POST(makeRequest({ content: "hello" }));
    const json = await res.json();
    expect(res.status).toBe(504);
    expect(json.error).toBe("Failed to process entry");
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

  it("claims and completes the idempotency key when an Idempotency-Key header is present", async () => {
    embedMock.mockResolvedValue([0.1, 0.2]);
    detectCrisisMock.mockResolvedValue({ triggered: false, source: "none" });
    const entry = { id: "e1", user_id: "u1", content: "hello", created_at: "2026-01-01" };
    fromMock.mockReturnValue(makeBuilder({ data: entry, error: null }));

    const res = await POST(
      makeRequest({ content: "hello" }, { "Idempotency-Key": "key-1" })
    );

    expect(res.status).toBe(200);
    expect(claimIdempotencyKeyMock).toHaveBeenCalledWith(
      expect.anything(),
      "key-1",
      "entries:write"
    );
    expect(completeIdempotencyKeyMock).toHaveBeenCalledWith(
      expect.anything(),
      "key-1",
      "entries:write",
      expect.objectContaining({ entry }),
      200
    );
  });

  it("replays the cached response instead of re-processing when the idempotency key is a replay", async () => {
    claimIdempotencyKeyMock.mockResolvedValue({
      replay: true,
      response: { entry: { id: "cached" } },
      statusCode: 200,
    });

    const res = await POST(
      makeRequest({ content: "hello" }, { "Idempotency-Key": "key-1" })
    );
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json).toEqual({ entry: { id: "cached" } });
    expect(embedMock).not.toHaveBeenCalled();
  });

  it("returns 409 when the idempotency key reports a conflict", async () => {
    claimIdempotencyKeyMock.mockResolvedValue({ replay: "conflict" });

    const res = await POST(
      makeRequest({ content: "hello" }, { "Idempotency-Key": "key-1" })
    );

    expect(res.status).toBe(409);
    expect(embedMock).not.toHaveBeenCalled();
  });
});
