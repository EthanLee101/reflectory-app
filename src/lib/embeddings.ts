import { gemini } from "@/lib/gemini";
import { serverEnv } from "@/lib/env";
import { GEMINI_EMBED_TIMEOUT_MS } from "@/lib/constants";

/**
 * Generate an embedding vector for a piece of text.
 *
 * MVP note: entries are embedded whole (no chunking). Journal entries are short
 * enough that whole-entry embeddings are a fine starting point. Revisit chunking
 * only if entries grow long enough to blur retrieval.
 */
export async function embed(text: string): Promise<number[]> {
  const input = text.replace(/\n/g, " ").trim();
  const response = await gemini().models.embedContent({
    model: serverEnv.embeddingModel,
    contents: input,
    config: {
      outputDimensionality: serverEnv.embeddingDim,
      abortSignal: AbortSignal.timeout(GEMINI_EMBED_TIMEOUT_MS),
    },
  });
  const values = response.embeddings?.[0].values;
  if (!values) {
    throw new Error("Gemini embedContent returned no embedding.");
  }
  return values;
}
