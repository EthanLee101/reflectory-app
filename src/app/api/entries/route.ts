import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { embed } from "@/lib/embeddings";
import { detectCrisis } from "@/lib/crisis";

/** GET /api/entries — list the current user's entries (RLS-scoped). */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("entries")
    .select("id, user_id, content, created_at")
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
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

  const { content } = await request.json();
  if (typeof content !== "string" || !content.trim()) {
    return NextResponse.json({ error: "Content is required" }, { status: 400 });
  }

  // Run embedding and crisis detection together — they're independent.
  let embedding: number[];
  let crisis: Awaited<ReturnType<typeof detectCrisis>>;
  try {
    [embedding, crisis] = await Promise.all([
      embed(content),
      detectCrisis(content),
    ]);
  } catch (err) {
    console.error("POST /api/entries: embedding failed", err);
    const message = err instanceof Error ? err.message : "Embedding failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }

  const { data, error } = await supabase
    .from("entries")
    // user_id is set by a DB default (auth.uid()); RLS enforces ownership.
    .insert({ content, embedding })
    .select("id, user_id, content, created_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ entry: data, crisis });
}
