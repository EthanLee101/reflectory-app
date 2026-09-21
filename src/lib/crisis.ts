import "server-only";
import { gemini } from "@/lib/gemini";
import { serverEnv } from "@/lib/env";
import { GEMINI_CLASSIFIER_TIMEOUT_MS } from "@/lib/constants";
import type { CrisisResult } from "@/lib/types";

/**
 * Crisis detection: a two-layer, "simple but real" check.
 *
 *   1. Keyword pass  — fast, deterministic, catches explicit language.
 *   2. LLM classifier — catches distress the keyword list misses.
 *
 * On a positive result the UI surfaces real crisis resources and the app does
 * NOT attempt to counsel the user through the crisis. A dependable simple
 * version beats a fragile clever one here.
 */

// Deliberately high-signal phrases. Kept conservative to limit false positives;
// the classifier is the safety net for everything phrased less directly.
const CRISIS_KEYWORDS = [
  "kill myself",
  "want to die",
  "end my life",
  "suicidal",
  "suicide",
  "self harm",
  "self-harm",
  "hurt myself",
  "cut myself",
  "no reason to live",
  "better off dead",
  "don't want to be here anymore",
];

function keywordCheck(text: string): boolean {
  const normalized = text.toLowerCase();
  return CRISIS_KEYWORDS.some((kw) => normalized.includes(kw));
}

async function classifierCheck(text: string): Promise<boolean> {
  const response = await gemini().models.generateContent({
    model: serverEnv.chatModel,
    contents: text,
    config: {
      temperature: 0,
      maxOutputTokens: 5,
      thinkingConfig: { thinkingBudget: 0 },
      abortSignal: AbortSignal.timeout(GEMINI_CLASSIFIER_TIMEOUT_MS),
      systemInstruction:
        "You are a safety classifier for a journaling app. Decide if the text indicates the writer may be in acute crisis — expressing suicidal thoughts, intent to self-harm, or immediate danger. Answer with a single character: 'Y' if yes, 'N' if no. Do not explain.",
    },
  });

  const answer = response.text?.trim().toUpperCase();
  return answer?.startsWith("Y") ?? false;
}

/**
 * Run the full crisis check. The keyword pass short-circuits the LLM call so an
 * obvious case never depends on a network round-trip.
 */
export async function detectCrisis(text: string): Promise<CrisisResult> {
  if (keywordCheck(text)) {
    return { triggered: true, source: "keyword" };
  }

  try {
    if (await classifierCheck(text)) {
      return { triggered: true, source: "classifier" };
    }
  } catch {
    // If the classifier call fails, fall back to the keyword result (already
    // negative here). Never block journaling on a classifier outage.
  }

  return { triggered: false, source: "none" };
}
