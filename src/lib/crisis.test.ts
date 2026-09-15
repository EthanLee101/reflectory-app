import { describe, it, expect, vi, beforeEach } from "vitest";

const { generateContentMock } = vi.hoisted(() => ({
  generateContentMock: vi.fn(),
}));
vi.mock("@/lib/gemini", () => ({
  gemini: () => ({ models: { generateContent: generateContentMock } }),
}));

import { detectCrisis } from "@/lib/crisis";

beforeEach(() => {
  generateContentMock.mockReset();
});

describe("detectCrisis", () => {
  describe("keyword layer", () => {
    it.each([
      "I want to kill myself",
      "I just want to die",
      "thinking about suicide lately",
      "I feel suicidal",
      "I've been trying to self harm",
      "self-harm has crossed my mind",
      "I hurt myself last night",
      "I cut myself again",
      "there's no reason to live anymore",
      "I'd be better off dead",
      "I don't want to be here anymore",
      "sometimes I think I should end my life",
    ])("triggers with source 'keyword' for: %s", async (text) => {
      const result = await detectCrisis(text);
      expect(result).toEqual({ triggered: true, source: "keyword" });
    });

    it("is case-insensitive", async () => {
      const result = await detectCrisis("I WANT TO KILL MYSELF today");
      expect(result).toEqual({ triggered: true, source: "keyword" });
    });

    it("short-circuits before calling the classifier", async () => {
      await detectCrisis("I want to kill myself");
      expect(generateContentMock).not.toHaveBeenCalled();
    });
  });

  describe("classifier layer (no keyword match)", () => {
    it("triggers with source 'classifier' when classifier answers Y", async () => {
      generateContentMock.mockResolvedValue({ text: "Y" });
      const result = await detectCrisis("everything feels pointless lately");
      expect(result).toEqual({ triggered: true, source: "classifier" });
      expect(generateContentMock).toHaveBeenCalledTimes(1);
    });

    it("does not trigger when classifier answers N", async () => {
      generateContentMock.mockResolvedValue({ text: "N" });
      const result = await detectCrisis("had a good day at work");
      expect(result).toEqual({ triggered: false, source: "none" });
    });

    it("does not trigger when the classifier response has no text", async () => {
      generateContentMock.mockResolvedValue({});
      const result = await detectCrisis("a fairly ordinary entry");
      expect(result).toEqual({ triggered: false, source: "none" });
    });

    it("fails open (not triggered) when the classifier throws", async () => {
      generateContentMock.mockRejectedValue(new Error("quota exceeded"));
      const result = await detectCrisis("some ambiguous journal text");
      expect(result).toEqual({ triggered: false, source: "none" });
    });
  });
});
