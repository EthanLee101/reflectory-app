/**
 * Maximum length (in characters) for a journal entry's content. Bounds
 * embedding/classifier/generation input size; shared by client-side textarea
 * limits and server-side validation.
 */
export const MAX_ENTRY_LENGTH = 5000;

/** Maximum length (in characters) for a semantic search query. */
export const MAX_SEARCH_QUERY_LENGTH = 200;

/**
 * Output token cap for the main reflection generation call (the most
 * expensive Gemini call in the app). Bounds worst-case cost per call while
 * still comfortably fitting "a few short paragraphs" per its system prompt.
 */
export const MAX_REFLECTION_OUTPUT_TOKENS = 700;

/**
 * Timeouts (ms) for external calls, so a hung Gemini or Supabase call can't
 * tie up a serverless function indefinitely. Passed as AbortSignal.timeout(ms).
 */
export const GEMINI_EMBED_TIMEOUT_MS = 8000;
export const GEMINI_CLASSIFIER_TIMEOUT_MS = 6000;
export const GEMINI_THEME_TIMEOUT_MS = 6000;
export const GEMINI_REFLECTION_TIMEOUT_MS = 20000;
export const SUPABASE_RPC_TIMEOUT_MS = 5000;

/** Default and max page size for cursor-based entry pagination. */
export const ENTRIES_PAGE_SIZE = 20;
export const ENTRIES_PAGE_SIZE_MAX = 50;
