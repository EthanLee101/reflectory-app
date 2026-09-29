import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const { generateContentMock, geminiMock, embedMock } = vi.hoisted(() => {
  const generateContentMock = vi.fn();
  return {
    generateContentMock,
    geminiMock: vi.fn(() => ({ models: { generateContent: generateContentMock } })),
    embedMock: vi.fn(),
  };
});

vi.mock("@/lib/gemini", () => ({ gemini: geminiMock }));
vi.mock("@/lib/embeddings", () => ({ embed: embedMock }));
vi.mock("@/lib/env", () => ({
  serverEnv: { chatModel: "test-model", embeddingModel: "test-embed", embeddingDim: 8 },
}));

import { MIN_REFLECTION_SIMILARITY } from "@/lib/constants";
import { generateReflection, retrieveRelatedToEntry, retrieveRelevantEntries } from "@/lib/rag";

const RETRYABLE = new Error('{"error":{"code":503,"status":"UNAVAILABLE"}}');
const NON_RETRYABLE = new Error("boom");

beforeEach(() => {
  generateContentMock.mockReset();
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("generateReflection", () => {
  it("retries once on a transient upstream failure and returns the eventual text", async () => {
    generateContentMock
      .mockRejectedValueOnce(RETRYABLE)
      .mockResolvedValueOnce({ text: "a warm reflection" });

    const promise = generateReflection("feeling okay", []);
    await vi.runAllTimersAsync();
    const result = await promise;

    expect(result).toBe("a warm reflection");
    expect(generateContentMock).toHaveBeenCalledTimes(2);
  });

  it("does not retry and rethrows on a non-retryable failure", async () => {
    generateContentMock.mockRejectedValue(NON_RETRYABLE);
    await expect(generateReflection("feeling okay", [])).rejects.toBe(NON_RETRYABLE);
    expect(generateContentMock).toHaveBeenCalledTimes(1);
  });
});

function fakeSupabase(result: { data: unknown; error: unknown }) {
  const rpc = vi.fn(() => ({ abortSignal: vi.fn(() => Promise.resolve(result)) }));
  return { rpc, client: { rpc } as never };
}

describe("retrieveRelevantEntries", () => {
  it("embeds the query and passes the similarity floor to match_entries", async () => {
    embedMock.mockResolvedValue([0.1, 0.2]);
    const { rpc, client } = fakeSupabase({ data: [], error: null });

    await retrieveRelevantEntries(client, "a query", { topK: 4, excludeEntryId: "e0" });

    expect(embedMock).toHaveBeenCalledWith("a query");
    expect(rpc).toHaveBeenCalledWith("match_entries", {
      query_embedding: [0.1, 0.2],
      match_count: 4,
      exclude_id: "e0",
      min_similarity: MIN_REFLECTION_SIMILARITY,
    });
  });

  it("lets the caller override the floor", async () => {
    embedMock.mockResolvedValue([0.1]);
    const { rpc, client } = fakeSupabase({ data: [], error: null });
    await retrieveRelevantEntries(client, "q", { minSimilarity: 0.3 });
    expect(rpc).toHaveBeenCalledWith(
      "match_entries",
      expect.objectContaining({ min_similarity: 0.3 })
    );
  });

  it("throws when the RPC errors", async () => {
    embedMock.mockResolvedValue([0.1]);
    const { client } = fakeSupabase({ data: null, error: { message: "boom" } });
    await expect(retrieveRelevantEntries(client, "q")).rejects.toThrow(/pgvector retrieval failed/);
  });
});

describe("retrieveRelatedToEntry", () => {
  it("calls match_entries_for_entry without embedding anything", async () => {
    embedMock.mockClear();
    const rows = [{ id: "e1", content: "x", created_at: "2026-01-01", similarity: 0.8 }];
    const { rpc, client } = fakeSupabase({ data: rows, error: null });

    const result = await retrieveRelatedToEntry(client, "e0", { topK: 4 });

    expect(embedMock).not.toHaveBeenCalled();
    expect(rpc).toHaveBeenCalledWith("match_entries_for_entry", {
      p_entry_id: "e0",
      match_count: 4,
      min_similarity: MIN_REFLECTION_SIMILARITY,
    });
    expect(result).toEqual(rows);
  });

  it("throws when the RPC errors", async () => {
    const { client } = fakeSupabase({ data: null, error: { message: "boom" } });
    await expect(retrieveRelatedToEntry(client, "e0")).rejects.toThrow(/pgvector retrieval failed/);
  });
});
