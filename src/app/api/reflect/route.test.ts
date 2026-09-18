import { describe, it, expect, vi, beforeEach } from "vitest";
import { MAX_ENTRY_LENGTH } from "@/lib/constants";

function makeInsertBuilder(result: { error: unknown } = { error: null }) {
  return { insert: vi.fn(() => Promise.resolve(result)) };
}

/** Mocks the `.from("entries").select(...).eq(...).eq(...).maybeSingle()` ownership check. */
function makeEntriesBuilder(owned: { id: string } | null = { id: "owned" }) {
  return {
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        eq: vi.fn(() => ({
          maybeSingle: vi.fn(() => Promise.resolve({ data: owned })),
        })),
      })),
    })),
  };
}

const {
  getUserMock,
  createClientMock,
  fromMock,
  detectCrisisMock,
  retrieveRelevantEntriesMock,
  generateReflectionMock,
  checkRateLimitMock,
} = vi.hoisted(() => ({
  getUserMock: vi.fn(),
  createClientMock: vi.fn(),
  fromMock: vi.fn(),
  detectCrisisMock: vi.fn(),
  retrieveRelevantEntriesMock: vi.fn(),
  generateReflectionMock: vi.fn(),
  checkRateLimitMock: vi.fn(),
}));

createClientMock.mockImplementation(() =>
  Promise.resolve({ auth: { getUser: getUserMock }, from: fromMock })
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
  fromMock
    .mockReset()
    .mockImplementation((table: string) =>
      table === "entries" ? makeEntriesBuilder() : makeInsertBuilder()
    );
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

  it("persists the reflection when an entryId is given", async () => {
    detectCrisisMock.mockResolvedValue({ triggered: false, source: "none" });
    retrieveRelevantEntriesMock.mockResolvedValue([]);
    generateReflectionMock.mockResolvedValue("a warm reflection");
    const insertMock = vi.fn(() => Promise.resolve({ error: null }));
    fromMock.mockImplementation((table: string) =>
      table === "entries" ? makeEntriesBuilder() : { insert: insertMock }
    );

    await POST(makeRequest({ content: "feeling okay today", entryId: "e0" }));

    expect(fromMock).toHaveBeenCalledWith("reflections");
    expect(insertMock).toHaveBeenCalledWith({
      entry_id: "e0",
      content: "a warm reflection",
      grounding: [],
      crisis_triggered: false,
      crisis_source: "none",
    });
  });

  it("does not persist or exclude an entryId that doesn't belong to the caller", async () => {
    detectCrisisMock.mockResolvedValue({ triggered: false, source: "none" });
    retrieveRelevantEntriesMock.mockResolvedValue([]);
    generateReflectionMock.mockResolvedValue("a warm reflection");
    fromMock.mockImplementation((table: string) =>
      table === "entries" ? makeEntriesBuilder(null) : makeInsertBuilder()
    );

    await POST(
      makeRequest({ content: "feeling okay today", entryId: "someone-elses-entry" })
    );

    expect(retrieveRelevantEntriesMock).toHaveBeenCalledWith(
      expect.anything(),
      "feeling okay today",
      { topK: 4, excludeEntryId: undefined }
    );
    expect(fromMock).not.toHaveBeenCalledWith("reflections");
  });

  it("skips persistence when no entryId is given", async () => {
    detectCrisisMock.mockResolvedValue({ triggered: false, source: "none" });
    retrieveRelevantEntriesMock.mockResolvedValue([]);
    generateReflectionMock.mockResolvedValue("a warm reflection");

    await POST(makeRequest({ content: "feeling okay today" }));

    expect(fromMock).not.toHaveBeenCalled();
  });

  it("still returns the reflection even if persisting it fails", async () => {
    detectCrisisMock.mockResolvedValue({ triggered: false, source: "none" });
    retrieveRelevantEntriesMock.mockResolvedValue([]);
    generateReflectionMock.mockResolvedValue("a warm reflection");
    fromMock.mockImplementation((table: string) =>
      table === "entries"
        ? makeEntriesBuilder()
        : {
            insert: vi.fn(() => {
              throw new Error("db unreachable");
            }),
          }
    );

    const res = await POST(
      makeRequest({ content: "feeling okay today", entryId: "e0" })
    );
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.reflection).toBe("a warm reflection");
  });

  it("still returns the reflection even if the ownership check itself fails", async () => {
    detectCrisisMock.mockResolvedValue({ triggered: false, source: "none" });
    retrieveRelevantEntriesMock.mockResolvedValue([]);
    generateReflectionMock.mockResolvedValue("a warm reflection");
    fromMock.mockImplementation(() => {
      throw new Error("db unreachable");
    });

    const res = await POST(
      makeRequest({ content: "feeling okay today", entryId: "e0" })
    );
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.reflection).toBe("a warm reflection");
  });

  it("returns 502 when detectCrisis throws", async () => {
    detectCrisisMock.mockRejectedValue(new Error("classifier network error"));
    const res = await POST(makeRequest({ content: "some entry text" }));
    const json = await res.json();
    expect(res.status).toBe(502);
    expect(json.error).toBe("Failed to generate reflection");
  });

  it("returns 502 when retrieval or generation throws", async () => {
    detectCrisisMock.mockResolvedValue({ triggered: false, source: "none" });
    retrieveRelevantEntriesMock.mockRejectedValue(new Error("pgvector rpc failed"));
    const res = await POST(makeRequest({ content: "some entry text" }));
    const json = await res.json();
    expect(res.status).toBe(502);
    expect(json.error).toBe("Failed to generate reflection");
  });
});
