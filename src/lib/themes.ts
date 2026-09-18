import "server-only";
import { gemini } from "@/lib/gemini";
import { serverEnv } from "@/lib/env";

/**
 * Extract 0–3 short theme tags from an entry (e.g. "work stress", "gratitude").
 *
 * Best-effort and non-blocking: unlike embedding (needed for RAG) or crisis
 * detection (needed for safety), tags are a nice-to-have. Any failure here is
 * caught internally and returns an empty list rather than failing the save.
 */
export async function extractThemes(text: string): Promise<string[]> {
  try {
    const response = await gemini().models.generateContent({
      model: serverEnv.chatModel,
      contents: text,
      config: {
        temperature: 0.2,
        maxOutputTokens: 60,
        thinkingConfig: { thinkingBudget: 0 },
        systemInstruction:
          "You extract short theme tags from a journal entry. Return at most 3 tags as a JSON array of lowercase strings, 1-3 words each (e.g. [\"work stress\", \"gratitude\"]). Return an empty array if nothing clearly stands out. Do not explain.",
        responseMimeType: "application/json",
        responseJsonSchema: {
          type: "array",
          items: { type: "string" },
          maxItems: 3,
        },
      },
    });

    const parsed: unknown = JSON.parse(response.text ?? "[]");
    if (!Array.isArray(parsed)) return [];

    return parsed
      .filter((tag): tag is string => typeof tag === "string")
      .map((tag) => tag.trim().toLowerCase())
      .filter(Boolean)
      .slice(0, 3);
  } catch (err) {
    console.error("extractThemes: failed, continuing without tags", err);
    return [];
  }
}
