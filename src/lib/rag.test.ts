import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const { generateContentMock, geminiMock } = vi.hoisted(() => {
  const generateContentMock = vi.fn();
  return {
    generateContentMock,
    geminiMock: vi.fn(() => ({ models: { generateContent: generateContentMock } })),
  };
});

vi.mock("@/lib/gemini", () => ({ gemini: geminiMock }));
vi.mock("@/lib/env", () => ({
  serverEnv: { chatModel: "test-model", embeddingModel: "test-embed", embeddingDim: 8 },
}));

import { generateReflection } from "@/lib/rag";

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
