/** A single journal entry as stored in the `entries` table. */
export interface Entry {
  id: string;
  user_id: string;
  content: string;
  /** Short, LLM-extracted theme tags (e.g. "work stress"). Best-effort. */
  themes: string[];
  created_at: string;
}

/** A past entry retrieved by similarity search, with its distance score. */
export interface RetrievedEntry {
  id: string;
  content: string;
  created_at: string;
  /** Cosine similarity in [0, 1]; higher = more relevant. */
  similarity: number;
}

/** Result of the crisis-detection check on a piece of user text. */
export interface CrisisResult {
  triggered: boolean;
  /** Which layer flagged it, useful for demoing the pipeline. */
  source: "none" | "keyword" | "classifier";
}

/** Response shape returned by POST /api/reflect. */
export interface ReflectResponse {
  reflection: string;
  /** The past entries used to ground the reflection (for visible RAG). */
  grounding: RetrievedEntry[];
  crisis: CrisisResult;
}

/** A persisted past reflection, as stored in the `reflections` table. */
export interface Reflection {
  id: string;
  entry_id: string;
  content: string;
  grounding: RetrievedEntry[];
  crisis: CrisisResult;
  created_at: string;
}
