import { GoogleGenAI } from "@google/genai";
import { serverEnv } from "@/lib/env";

/**
 * Singleton Gemini client. Server-only — never import into a client component.
 */
let client: GoogleGenAI | null = null;

export function gemini(): GoogleGenAI {
  if (!client) {
    client = new GoogleGenAI({ apiKey: serverEnv.geminiApiKey });
  }
  return client;
}
