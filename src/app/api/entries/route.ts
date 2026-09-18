import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { embed } from "@/lib/embeddings";
import { detectCrisis } from "@/lib/crisis";
import { extractThemes } from "@/lib/themes";
import { checkRateLimit } from "@/lib/rate-limit";
import { MAX_ENTRY_LENGTH } from "@/lib/constants";

/** GET /api/entries — list the current user's entries (RLS-scoped). */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("entries")
    .select("id, user_id, content, themes, created_at")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("GET /api/entries: query failed", error);
    return NextResponse.json({ error: "Failed to load entries" }, { status: 500 });
  }
  return NextResponse.json({ entries: data });
}

/**
 * POST /api/entries — create an entry.
 * Generates an embedding for pgvector retrieval and runs the crisis check.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const allowed = await checkRateLimit(supabase, "entries:write");
  if (!allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please slow down." },
      { status: 429 }
    );
  }

  const { content } = await request.json();
  if (typeof content !== "string" || !content.trim()) {
    return NextResponse.json({ error: "Content is required" }, { status: 400 });
  }
  if (content.length > MAX_ENTRY_LENGTH) {
    return NextResponse.json(
      { error: `Content must be ${MAX_ENTRY_LENGTH} characters or fewer` },
      { status: 400 }
    );
  }

  // Run embedding, crisis detection, and theme extraction together — they're
  // independent. Theme extraction fails soft internally (see extractThemes),
  // so it never causes this Promise.all to reject.
  let embedding: number[];
  let crisis: Awaited<ReturnType<typeof detectCrisis>>;
  let themes: string[];
  try {
    [embedding, crisis, themes] = await Promise.all([
      embed(content),
      detectCrisis(content),
      extractThemes(content),
    ]);
  } catch (err) {
    console.error("POST /api/entries: embedding failed", err);
    return NextResponse.json({ error: "Failed to process entry" }, { status: 502 });
  }

  const { data, error } = await supabase
    .from("entries")
    // user_id is set by a DB default (auth.uid()); RLS enforces ownership.
    .insert({ content, embedding, themes })
    .select("id, user_id, content, themes, created_at")
    .single();

  if (error) {
    console.error("POST /api/entries: insert failed", error);
    return NextResponse.json({ error: "Failed to save entry" }, { status: 500 });
  }

  return NextResponse.json({ entry: data, crisis });
}
