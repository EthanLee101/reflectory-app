/**
 * Maximum length (in characters) for a journal entry's content. Bounds
 * embedding/classifier/generation input size; shared by client-side textarea
 * limits and server-side validation.
 */
export const MAX_ENTRY_LENGTH = 5000;

/** Maximum length (in characters) for a semantic search query. */
export const MAX_SEARCH_QUERY_LENGTH = 200;
