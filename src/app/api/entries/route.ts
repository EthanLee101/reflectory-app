import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { embed } from "@/lib/embeddings";
import { detectCrisis } from "@/lib/crisis";
import { extractThemes } from "@/lib/themes";
import { checkRateLimit } from "@/lib/rate-limit";
import { claimIdempotencyKey, completeIdempotencyKey, releaseIdempotencyKey } from "@/lib/idempotency";
import { logError } from "@/lib/logger";
import { MAX_ENTRY_LENGTH, ENTRIES_PAGE_SIZE, ENTRIES_PAGE_SIZE_MAX } from "@/lib/constants";

/**
 * GET /api/entries?cursor=&limit= — list the current user's entries
 * (RLS-scoped), newest first, cursor-paginated on created_at.
 */
export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const params = new URL(request.url).searchParams;
  const cursor = params.get("cursor");
  const limit = Math.min(
    Number(params.get("limit")) || ENTRIES_PAGE_SIZE,
    ENTRIES_PAGE_SIZE_MAX
  );

  let query = supabase
    .from("entries")
    .select("id, user_id, content, themes, created_at")
    .order("created_at", { ascending: false })
    .limit(limit + 1);

  if (cursor) query = query.lt("created_at", cursor);

  const { data, error } = await query;

  if (error) {
    logError("GET /api/entries", error);
    return NextResponse.json({ error: "Failed to load entries" }, { status: 500 });
  }

  const page = data ?? [];
  const hasMore = page.length > limit;
  const entries = hasMore ? page.slice(0, limit) : page;
  const nextCursor = hasMore ? entries[entries.length - 1].created_at : null;

  return NextResponse.json({ entries, nextCursor });
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

  const idempotencyKey = request.headers.get("Idempotency-Key");
  if (idempotencyKey) {
    const claim = await claimIdempotencyKey(supabase, idempotencyKey, "entries:write");
    if (claim.replay === true) {
      return NextResponse.json(claim.response, { status: claim.statusCode });
    }
    if (claim.replay === "conflict") {
      return NextResponse.json(
        { error: "Duplicate request already in progress." },
        { status: 409 }
      );
    }
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
    logError("POST /api/entries", err, { stage: "embedding" });
    if (idempotencyKey) await releaseIdempotencyKey(supabase, idempotencyKey, "entries:write");
    const status = err instanceof Error && err.name === "TimeoutError" ? 504 : 502;
    return NextResponse.json({ error: "Failed to process entry" }, { status });
  }

  const { data, error } = await supabase
    .from("entries")
    // user_id is set by a DB default (auth.uid()); RLS enforces ownership.
    .insert({ content, embedding, themes })
    .select("id, user_id, content, themes, created_at")
    .single();

  if (error) {
    logError("POST /api/entries", error, { stage: "insert" });
    if (idempotencyKey) await releaseIdempotencyKey(supabase, idempotencyKey, "entries:write");
    return NextResponse.json({ error: "Failed to save entry" }, { status: 500 });
  }

  const responseBody = { entry: data, crisis };
  if (idempotencyKey) {
    await completeIdempotencyKey(supabase, idempotencyKey, "entries:write", responseBody, 200);
  }

  return NextResponse.json(responseBody);
}
