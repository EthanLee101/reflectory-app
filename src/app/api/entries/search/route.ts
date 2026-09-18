import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { retrieveRelevantEntries } from "@/lib/rag";
import { checkRateLimit } from "@/lib/rate-limit";
import { MAX_SEARCH_QUERY_LENGTH } from "@/lib/constants";

/**
 * GET /api/entries/search?q=... — semantic search over the caller's own
 * entries. Reuses the same pgvector retrieval (`match_entries` via
 * `retrieveRelevantEntries`) that grounds "Reflect on this" — here surfaced
 * directly as a user-facing "recall" feature instead of feeding a prompt.
 */
export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const allowed = await checkRateLimit(supabase, "search");
  if (!allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please slow down." },
      { status: 429 }
    );
  }

  const q = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  if (!q) {
    return NextResponse.json({ error: "Query is required" }, { status: 400 });
  }
  if (q.length > MAX_SEARCH_QUERY_LENGTH) {
    return NextResponse.json(
      { error: `Query must be ${MAX_SEARCH_QUERY_LENGTH} characters or fewer` },
      { status: 400 }
    );
  }

  try {
    const results = await retrieveRelevantEntries(supabase, q, { topK: 8 });
    return NextResponse.json({ results });
  } catch (err) {
    console.error("GET /api/entries/search: retrieval failed", err);
    return NextResponse.json({ error: "Search failed" }, { status: 502 });
  }
}
