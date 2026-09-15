import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { retrieveRelevantEntries, generateReflection } from "@/lib/rag";
import { detectCrisis } from "@/lib/crisis";
import type { ReflectResponse } from "@/lib/types";

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

  const { entryId, content } = await request.json();
  if (typeof content !== "string" || !content.trim()) {
    return NextResponse.json({ error: "Content is required" }, { status: 400 });
  }

  const crisis = await detectCrisis(content);
  if (crisis.triggered) {
    const safe: ReflectResponse = {
      reflection:
        "I want to pause here. It sounds like you're carrying something really heavy right now, and you deserve support from someone who can be fully present with you. Please take a look at the resources above.",
      grounding: [],
      crisis,
    };
    return NextResponse.json(safe);
  }

  const grounding = await retrieveRelevantEntries(supabase, content, {
    topK: 4,
    excludeEntryId: typeof entryId === "string" ? entryId : undefined,
  });

  const reflection = await generateReflection(content, grounding);

  const response: ReflectResponse = { reflection, grounding, crisis };
  return NextResponse.json(response);
}
