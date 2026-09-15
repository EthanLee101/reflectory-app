import { describe, it, expect, vi, beforeEach } from "vitest";
import { MAX_ENTRY_LENGTH } from "@/lib/constants";

const {
  getUserMock,
  createClientMock,
  detectCrisisMock,
  retrieveRelevantEntriesMock,
  generateReflectionMock,
  checkRateLimitMock,
} = vi.hoisted(() => ({
  getUserMock: vi.fn(),
  createClientMock: vi.fn(),
  detectCrisisMock: vi.fn(),
  retrieveRelevantEntriesMock: vi.fn(),
  generateReflectionMock: vi.fn(),
  checkRateLimitMock: vi.fn(),
}));

createClientMock.mockImplementation(() =>
  Promise.resolve({ auth: { getUser: getUserMock } })
);

vi.mock("@/lib/supabase/server", () => ({
  createClient: createClientMock,
}));

vi.mock("@/lib/crisis", () => ({
  detectCrisis: detectCrisisMock,
}));

vi.mock("@/lib/rag", () => ({
  retrieveRelevantEntries: retrieveRelevantEntriesMock,
  generateReflection: generateReflectionMock,
}));

vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: checkRateLimitMock,
}));

import { POST } from "@/app/api/reflect/route";

function makeRequest(body: unknown) {
  return new Request("http://localhost/api/reflect", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

beforeEach(() => {
  getUserMock.mockReset().mockResolvedValue({ data: { user: { id: "u1" } } });
  detectCrisisMock.mockReset();
  retrieveRelevantEntriesMock.mockReset();
  generateReflectionMock.mockReset();
  checkRateLimitMock.mockReset().mockResolvedValue(true);
});

describe("POST /api/reflect", () => {
  it("returns 401 when there is no authenticated user, without touching crisis/rag", async () => {
    getUserMock.mockResolvedValue({ data: { user: null } });
    const res = await POST(makeRequest({ content: "hello" }));
    expect(res.status).toBe(401);
    expect(detectCrisisMock).not.toHaveBeenCalled();
    expect(retrieveRelevantEntriesMock).not.toHaveBeenCalled();
    expect(generateReflectionMock).not.toHaveBeenCalled();
  });

  it.each([{ content: undefined }, { content: "" }, { content: "   " }])(
    "returns 400 for invalid content: %j",
    async (body) => {
      const res = await POST(makeRequest(body));
      expect(res.status).toBe(400);
    }
  );

  it("returns 400 for content over the max length", async () => {
    const res = await POST(
      makeRequest({ content: "a".repeat(MAX_ENTRY_LENGTH + 1) })
    );
    expect(res.status).toBe(400);
  });

  it("returns 429 when rate limited, without touching crisis/rag", async () => {
    checkRateLimitMock.mockResolvedValue(false);
    const res = await POST(makeRequest({ content: "hello" }));
    expect(res.status).toBe(429);
    expect(detectCrisisMock).not.toHaveBeenCalled();
    expect(retrieveRelevantEntriesMock).not.toHaveBeenCalled();
    expect(generateReflectionMock).not.toHaveBeenCalled();
  });

  it("returns the canned safe response and skips retrieval/generation when crisis triggers", async () => {
    detectCrisisMock.mockResolvedValue({ triggered: true, source: "keyword" });
    const res = await POST(makeRequest({ content: "I want to kill myself" }));
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.grounding).toEqual([]);
    expect(json.crisis).toEqual({ triggered: true, source: "keyword" });
    expect(typeof json.reflection).toBe("string");
    expect(json.reflection.length).toBeGreaterThan(0);
    expect(retrieveRelevantEntriesMock).not.toHaveBeenCalled();
    expect(generateReflectionMock).not.toHaveBeenCalled();
  });

  it("retrieves grounding and generates a reflection when crisis does not trigger", async () => {
    detectCrisisMock.mockResolvedValue({ triggered: false, source: "none" });
    const grounding = [
      { id: "e1", content: "past entry", created_at: "2026-01-01", similarity: 0.9 },
    ];
    retrieveRelevantEntriesMock.mockResolvedValue(grounding);
    generateReflectionMock.mockResolvedValue("a warm reflection");

    const res = await POST(
      makeRequest({ content: "feeling okay today", entryId: "e0" })
    );
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(retrieveRelevantEntriesMock).toHaveBeenCalledWith(
      expect.anything(),
      "feeling okay today",
      { topK: 4, excludeEntryId: "e0" }
    );
    expect(generateReflectionMock).toHaveBeenCalledWith(
      "feeling okay today",
      grounding
    );
    expect(json).toEqual({
      reflection: "a warm reflection",
      grounding,
      crisis: { triggered: false, source: "none" },
    });
  });

  it("returns 502 when detectCrisis throws", async () => {
    detectCrisisMock.mockRejectedValue(new Error("classifier network error"));
    const res = await POST(makeRequest({ content: "some entry text" }));
    const json = await res.json();
    expect(res.status).toBe(502);
    expect(json.error).toBe("classifier network error");
  });

  it("returns 502 when retrieval or generation throws", async () => {
    detectCrisisMock.mockResolvedValue({ triggered: false, source: "none" });
    retrieveRelevantEntriesMock.mockRejectedValue(new Error("pgvector rpc failed"));
    const res = await POST(makeRequest({ content: "some entry text" }));
    const json = await res.json();
    expect(res.status).toBe(502);
    expect(json.error).toBe("pgvector rpc failed");
  });
});
