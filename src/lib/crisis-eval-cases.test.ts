import { describe, it, expect, vi, beforeEach } from "vitest";
import { BENIGN, EXPLICIT_POSITIVES, INDIRECT_POSITIVES } from "@/lib/crisis-eval-cases";

const { generateContentMock } = vi.hoisted(() => ({ generateContentMock: vi.fn() }));
vi.mock("@/lib/gemini", () => ({
  gemini: () => ({ models: { generateContent: generateContentMock } }),
}));

import { detectCrisis } from "@/lib/crisis";

beforeEach(() => {
  // Classifier says "no" for everything, so any trigger below came from the keyword layer.
  generateContentMock.mockReset().mockResolvedValue({ text: "N" });
});

describe("crisis keyword layer against the labeled cases", () => {
  it("has a non-trivial labeled set", () => {
    expect(EXPLICIT_POSITIVES.length).toBeGreaterThanOrEqual(5);
    expect(INDIRECT_POSITIVES.length).toBeGreaterThanOrEqual(5);
    expect(BENIGN.length).toBeGreaterThanOrEqual(8);
  });

  it.each(EXPLICIT_POSITIVES)("catches explicit language via keyword: %s", async (text) => {
    expect(await detectCrisis(text)).toEqual({ triggered: true, source: "keyword" });
  });

  it.each(BENIGN)("does not flag a benign entry: %s", async (text) => {
    expect((await detectCrisis(text)).triggered).toBe(false);
  });

  it("leaves indirect phrasing to the classifier (keyword layer alone misses it)", async () => {
    const results = await Promise.all(INDIRECT_POSITIVES.map((t) => detectCrisis(t)));
    expect(results.every((r) => r.source !== "keyword")).toBe(true);
  });
});
