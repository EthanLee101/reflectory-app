import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { retrieveRelevantEntries, generateReflection } from "@/lib/rag";
import { detectCrisis } from "@/lib/crisis";
import { checkRateLimit } from "@/lib/rate-limit";
import { claimIdempotencyKey, completeIdempotencyKey, releaseIdempotencyKey } from "@/lib/idempotency";
import { logError } from "@/lib/logger";
import { MAX_ENTRY_LENGTH } from "@/lib/constants";
import type { ReflectResponse } from "@/lib/types";

// This route's steps run mostly sequentially (crisis check -> retrieve ->
// generate), so give it headroom beyond Vercel's default function duration.
export const maxDuration = 30;

/**
 * Best-effort persistence so past reflections survive a reload. Never throws:
 * the user already has their reflection by the time this runs, so a write
 * failure here should only be logged, not surfaced as a request failure.
 */
async function persistReflection(
  supabase: SupabaseClient,
  entryId: string,
  response: ReflectResponse
) {
  try {
    const { error } = await supabase.from("reflections").insert({
      entry_id: entryId,
      content: response.reflection,
      grounding: response.grounding,
      crisis_triggered: response.crisis.triggered,
      crisis_source: response.crisis.source,
    });
    if (error) logError("persistReflection", error);
  } catch (err) {
    logError("persistReflection", err, { note: "unexpected error" });
  }
}

/**
 * POST /api/reflect — the RAG heart of the app.
 *
 * 1. Crisis check the input first. If triggered, hand off to resources and skip
 *    generating a reflection (the app does not counsel through a crisis).
 * 2. Retrieve the user's top-k relevant past entries via pgvector.
 * 3. Compose a grounded prompt and generate a warm, non-clinical reflection.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const allowed = await checkRateLimit(supabase, "reflect");
  if (!allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please slow down." },
      { status: 429 }
    );
  }

  const idempotencyKey = request.headers.get("Idempotency-Key");
  if (idempotencyKey) {
    const claim = await claimIdempotencyKey(supabase, idempotencyKey, "reflect");
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

  const { entryId, content } = await request.json();
  if (typeof content !== "string" || !content.trim()) {
    if (idempotencyKey) await releaseIdempotencyKey(supabase, idempotencyKey, "reflect");
    return NextResponse.json({ error: "Content is required" }, { status: 400 });
  }
  if (content.length > MAX_ENTRY_LENGTH) {
    if (idempotencyKey) await releaseIdempotencyKey(supabase, idempotencyKey, "reflect");
    return NextResponse.json(
      { error: `Content must be ${MAX_ENTRY_LENGTH} characters or fewer` },
      { status: 400 }
    );
  }

  let validEntryId: string | undefined;
  if (typeof entryId === "string") {
    try {
      const { data: owned } = await supabase
        .from("entries")
        .select("id")
        .eq("id", entryId)
        .eq("user_id", user.id)
        .maybeSingle();
      if (owned) validEntryId = entryId;
    } catch (err) {
      logError("POST /api/reflect", err, { stage: "ownership check" });
    }
  }

  try {
    const crisis = await detectCrisis(content);
    if (crisis.triggered) {
      const safe: ReflectResponse = {
        reflection:
          "I want to pause here. It sounds like you're carrying something really heavy right now, and you deserve support from someone who can be fully present with you. Please take a look at the resources above.",
        grounding: [],
        crisis,
      };
      if (validEntryId) await persistReflection(supabase, validEntryId, safe);
      if (idempotencyKey) await completeIdempotencyKey(supabase, idempotencyKey, "reflect", safe, 200);
      return NextResponse.json(safe);
    }

    const grounding = await retrieveRelevantEntries(supabase, content, {
      topK: 4,
      excludeEntryId: validEntryId,
    });

    const reflection = await generateReflection(content, grounding);

    const response: ReflectResponse = { reflection, grounding, crisis };
    if (validEntryId) await persistReflection(supabase, validEntryId, response);
    if (idempotencyKey) await completeIdempotencyKey(supabase, idempotencyKey, "reflect", response, 200);
    return NextResponse.json(response);
  } catch (err) {
    logError("POST /api/reflect", err, { stage: "reflection" });
    if (idempotencyKey) await releaseIdempotencyKey(supabase, idempotencyKey, "reflect");
    const status = err instanceof Error && err.name === "TimeoutError" ? 504 : 502;
    return NextResponse.json({ error: "Failed to generate reflection" }, { status });
  }
}
