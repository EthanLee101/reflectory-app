import { describe, it, expect, vi, beforeEach } from "vitest";

const { generateContentMock } = vi.hoisted(() => ({
  generateContentMock: vi.fn(),
}));
vi.mock("@/lib/gemini", () => ({
  gemini: () => ({ models: { generateContent: generateContentMock } }),
}));

import { extractThemes } from "@/lib/themes";

beforeEach(() => {
  generateContentMock.mockReset();
});

describe("extractThemes", () => {
  it("returns the parsed, normalized tags on success", async () => {
    generateContentMock.mockResolvedValue({
      text: '[" Work Stress ", "gratitude"]',
    });
    const result = await extractThemes("a long day at the office");
    expect(result).toEqual(["work stress", "gratitude"]);
  });

  it("caps tags at 3, drops non-string entries, and drops blanks", async () => {
    generateContentMock.mockResolvedValue({
      text: '["a", "b", "  ", 5, "c", "d"]',
    });
    const result = await extractThemes("entry");
    expect(result).toEqual(["a", "b", "c"]);
  });

  it("returns an empty list when the response isn't a JSON array", async () => {
    generateContentMock.mockResolvedValue({ text: "not json" });
    const result = await extractThemes("entry");
    expect(result).toEqual([]);
  });

  it("returns an empty list when there is no response text", async () => {
    generateContentMock.mockResolvedValue({});
    const result = await extractThemes("entry");
    expect(result).toEqual([]);
  });

  it("fails soft (empty list) when the call throws", async () => {
    generateContentMock.mockRejectedValue(new Error("quota exceeded"));
    const result = await extractThemes("entry");
    expect(result).toEqual([]);
  });
});
