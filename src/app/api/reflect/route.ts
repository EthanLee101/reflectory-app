import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { retrieveRelevantEntries, generateReflection } from "@/lib/rag";
import { detectCrisis } from "@/lib/crisis";
import { checkRateLimit } from "@/lib/rate-limit";
import { MAX_ENTRY_LENGTH } from "@/lib/constants";
import type { ReflectResponse } from "@/lib/types";

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
    if (error) console.error("persistReflection: insert failed", error);
  } catch (err) {
    console.error("persistReflection: unexpected error", err);
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

  const { entryId, content } = await request.json();
  if (typeof content !== "string" || !content.trim()) {
    return NextResponse.json({ error: "Content is required" }, { status: 400 });
  }
  if (content.length > MAX_ENTRY_LENGTH) {
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
      console.error("POST /api/reflect: entry ownership check failed", err);
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
      return NextResponse.json(safe);
    }

    const grounding = await retrieveRelevantEntries(supabase, content, {
      topK: 4,
      excludeEntryId: validEntryId,
    });

    const reflection = await generateReflection(content, grounding);

    const response: ReflectResponse = { reflection, grounding, crisis };
    if (validEntryId) await persistReflection(supabase, validEntryId, response);
    return NextResponse.json(response);
  } catch (err) {
    console.error("POST /api/reflect: reflection failed", err);
    return NextResponse.json({ error: "Failed to generate reflection" }, { status: 502 });
  }
}
