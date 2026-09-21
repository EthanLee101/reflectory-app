import type { SupabaseClient } from "@supabase/supabase-js";
import { gemini } from "@/lib/gemini";
import { embed } from "@/lib/embeddings";
import { serverEnv } from "@/lib/env";
import {
  GEMINI_REFLECTION_TIMEOUT_MS,
  MAX_REFLECTION_OUTPUT_TOKENS,
  SUPABASE_RPC_TIMEOUT_MS,
} from "@/lib/constants";
import { withRetry } from "@/lib/retry";
import type { RetrievedEntry } from "@/lib/types";

/**
 * The RAG pipeline: retrieve the user's most relevant past entries via pgvector,
 * then compose a grounded prompt and generate a warm, non-clinical reflection.
 *
 * RLS still applies to the `match_entries` RPC because we pass the user-scoped
 * Supabase client — a user can only ever match against their own entries.
 */

const SYSTEM_PROMPT = `You are Reflectory, a warm, gentle reflection companion inside a personal journaling app.

Your role:
- Reflect back what you notice with kindness and curiosity — never diagnose, never give clinical or medical advice.
- Ground your reflection in the user's OWN past entries provided as context. When you draw a connection to something they wrote before, reference it naturally (e.g. "this echoes what you wrote earlier about...").
- Be concise (a few short paragraphs), human, and non-judgmental. No bullet-point lists, no therapy jargon.
- You are not a therapist or a crisis service. If the user is in crisis, the app handles that separately — do not attempt to counsel them through it.

Write in second person, directly to the writer.`;

/**
 * Retrieve the top-k most relevant past entries for a query, excluding the
 * entry currently being reflected on (if provided).
 */
export async function retrieveRelevantEntries(
  supabase: SupabaseClient,
  query: string,
  options: { topK?: number; excludeEntryId?: string } = {}
): Promise<RetrievedEntry[]> {
  const { topK = 4, excludeEntryId } = options;
  const queryEmbedding = await embed(query);

  const { data, error } = await supabase
    .rpc("match_entries", {
      query_embedding: queryEmbedding,
      match_count: topK,
      exclude_id: excludeEntryId ?? null,
    })
    .abortSignal(AbortSignal.timeout(SUPABASE_RPC_TIMEOUT_MS));

  if (error) {
    throw new Error(`pgvector retrieval failed: ${error.message}`);
  }

  return (data ?? []) as RetrievedEntry[];
}

/** Compose the grounded prompt and generate the reflection. */
export async function generateReflection(
  currentEntry: string,
  grounding: RetrievedEntry[]
): Promise<string> {
  const context =
    grounding.length > 0
      ? grounding
          .map(
            (e, i) =>
              `[Past entry ${i + 1} — ${new Date(
                e.created_at
              ).toLocaleDateString()}]\n${e.content}`
          )
          .join("\n\n")
      : "(No closely related past entries were found.)";

  const userPrompt = `Here is what the writer just journaled:\n\n"""\n${currentEntry}\n"""\n\nHere are some of their relevant past entries for context:\n\n${context}\n\nWrite a warm, grounded reflection.`;

  // Retries once on a transient upstream failure (e.g. a Gemini "model
  // overloaded" 503) — this is the app's single most expensive, most
  // user-visible call, and POST /api/reflect's extended maxDuration gives
  // enough headroom to safely absorb one retry. A fresh AbortSignal.timeout
  // is created per attempt since a fired signal can't be reused.
  const response = await withRetry(() =>
    gemini().models.generateContent({
      model: serverEnv.chatModel,
      contents: userPrompt,
      config: {
        temperature: 0.7,
        maxOutputTokens: MAX_REFLECTION_OUTPUT_TOKENS,
        abortSignal: AbortSignal.timeout(GEMINI_REFLECTION_TIMEOUT_MS),
        systemInstruction: SYSTEM_PROMPT,
      },
    })
  );

  return response.text?.trim() ?? "";
}
