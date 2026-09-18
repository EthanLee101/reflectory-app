import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { embed } from "@/lib/embeddings";
import { detectCrisis } from "@/lib/crisis";
import { extractThemes } from "@/lib/themes";
import { checkRateLimit } from "@/lib/rate-limit";
import { MAX_ENTRY_LENGTH } from "@/lib/constants";

/**
 * PATCH /api/entries/:id — edit an entry's content.
 * Re-generates the embedding and re-runs the crisis check, same as creation,
 * since both depend on the entry's text.
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
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
    console.error("PATCH /api/entries/[id]: embedding failed", err);
    return NextResponse.json({ error: "Failed to process entry" }, { status: 502 });
  }

  const { data, error } = await supabase
    .from("entries")
    .update({ content, embedding, themes })
    .eq("id", id)
    .eq("user_id", user.id)
    .select("id, user_id, content, themes, created_at")
    .maybeSingle();

  if (error) {
    console.error("PATCH /api/entries/[id]: update failed", error);
    return NextResponse.json({ error: "Failed to save entry" }, { status: 500 });
  }
  if (!data) return NextResponse.json({ error: "Entry not found" }, { status: 404 });

  return NextResponse.json({ entry: data, crisis });
}

/**
 * DELETE /api/entries/:id — delete an entry.
 * RLS scopes the query to the caller's own rows, so a missing/foreign id
 * looks identical to "not found" here — that's intentional.
 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("entries")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id)
    .select("id")
    .maybeSingle();

  if (error) {
    console.error("DELETE /api/entries/[id]: delete failed", error);
    return NextResponse.json({ error: "Failed to delete entry" }, { status: 500 });
  }
  if (!data) return NextResponse.json({ error: "Entry not found" }, { status: 404 });

  return new NextResponse(null, { status: 204 });
}
