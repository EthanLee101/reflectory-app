/**
 * Centralized, validated access to environment variables.
 * Throws early with a clear message instead of failing deep inside an API call.
 */

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Missing required environment variable: ${name}. See .env.example.`
    );
  }
  return value;
}

function optional(name: string, fallback: string): string {
  return process.env[name] ?? fallback;
}

// Public (browser-safe). Next.js only inlines NEXT_PUBLIC_ vars into the
// client bundle when read as a literal `process.env.NAME`, so these can't
// go through the `required(name)` helper.
export const publicEnv = {
  get supabaseUrl() {
    const value = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (!value) {
      throw new Error(
        "Missing required environment variable: NEXT_PUBLIC_SUPABASE_URL. See .env.example."
      );
    }
    return value;
  },
  get supabasePublishableKey() {
    const value = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    if (!value) {
      throw new Error(
        "Missing required environment variable: NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY. See .env.example."
      );
    }
    return value;
  },
};

// Server-only. Never import into a client component.
export const serverEnv = {
  get geminiApiKey() {
    return required("GEMINI_API_KEY");
  },
  get chatModel() {
    return optional("GEMINI_CHAT_MODEL", "gemini-flash-latest");
  },
  get embeddingModel() {
    return optional("GEMINI_EMBEDDING_MODEL", "gemini-embedding-001");
  },
  get embeddingDim() {
    return Number(optional("GEMINI_EMBEDDING_DIM", "1536"));
  },
};
