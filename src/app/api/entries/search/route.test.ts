import { describe, it, expect, vi, beforeEach } from "vitest";
import { MAX_SEARCH_QUERY_LENGTH } from "@/lib/constants";

const { getUserMock, createClientMock, retrieveRelevantEntriesMock, checkRateLimitMock } =
  vi.hoisted(() => ({
    getUserMock: vi.fn(),
    createClientMock: vi.fn(),
    retrieveRelevantEntriesMock: vi.fn(),
    checkRateLimitMock: vi.fn(),
  }));

createClientMock.mockImplementation(() =>
  Promise.resolve({ auth: { getUser: getUserMock } })
);

vi.mock("@/lib/supabase/server", () => ({ createClient: createClientMock }));
vi.mock("@/lib/rag", () => ({
  retrieveRelevantEntries: retrieveRelevantEntriesMock,
}));
vi.mock("@/lib/rate-limit", () => ({ checkRateLimit: checkRateLimitMock }));

import { GET } from "@/app/api/entries/search/route";

function makeRequest(query: string | null) {
  const url = new URL("http://localhost/api/entries/search");
  if (query !== null) url.searchParams.set("q", query);
  return new Request(url);
}

beforeEach(() => {
  getUserMock.mockReset().mockResolvedValue({ data: { user: { id: "u1" } } });
  retrieveRelevantEntriesMock.mockReset();
  checkRateLimitMock.mockReset().mockResolvedValue(true);
});

describe("GET /api/entries/search", () => {
  it("returns 401 when there is no authenticated user", async () => {
    getUserMock.mockResolvedValue({ data: { user: null } });
    const res = await GET(makeRequest("work"));
    expect(res.status).toBe(401);
  });

  it("returns 429 when rate limited", async () => {
    checkRateLimitMock.mockResolvedValue(false);
    const res = await GET(makeRequest("work"));
    expect(res.status).toBe(429);
    expect(retrieveRelevantEntriesMock).not.toHaveBeenCalled();
  });

  it("returns 400 for a missing or empty query", async () => {
    const res = await GET(makeRequest(null));
    expect(res.status).toBe(400);
  });

  it("returns 400 for a query over the max length", async () => {
    const res = await GET(makeRequest("a".repeat(MAX_SEARCH_QUERY_LENGTH + 1)));
    expect(res.status).toBe(400);
  });

  it("returns 502 when retrieval fails", async () => {
    retrieveRelevantEntriesMock.mockRejectedValue(new Error("pgvector rpc failed"));
    const res = await GET(makeRequest("work"));
    const json = await res.json();
    expect(res.status).toBe(502);
    expect(json.error).toBe("Search failed");
  });

  it("returns 504 when retrieval times out", async () => {
    const timeoutErr = new Error("The operation was aborted");
    timeoutErr.name = "TimeoutError";
    retrieveRelevantEntriesMock.mockRejectedValue(timeoutErr);
    const res = await GET(makeRequest("work"));
    const json = await res.json();
    expect(res.status).toBe(504);
    expect(json.error).toBe("Search failed");
  });

  it("returns the retrieved results on success", async () => {
    const results = [
      { id: "e1", content: "past entry about work", created_at: "2026-01-01", similarity: 0.8 },
    ];
    retrieveRelevantEntriesMock.mockResolvedValue(results);

    const res = await GET(makeRequest("work"));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.results).toEqual(results);
    expect(retrieveRelevantEntriesMock).toHaveBeenCalledWith(
      expect.anything(),
      "work",
      { topK: 8 }
    );
  });
});
