import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { Reflection } from "@/lib/types";

/** GET /api/entries/:id/reflections — list an entry's past reflections, newest first. */
export async function GET(
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
    .from("reflections")
    .select("id, entry_id, content, grounding, crisis_triggered, crisis_source, created_at")
    .eq("entry_id", id)
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("GET /api/entries/[id]/reflections: query failed", error);
    return NextResponse.json({ error: "Failed to load reflections" }, { status: 500 });
  }

  const reflections: Reflection[] = (data ?? []).map((row) => ({
    id: row.id,
    entry_id: row.entry_id,
    content: row.content,
    grounding: row.grounding ?? [],
    crisis: {
      triggered: row.crisis_triggered,
      source: row.crisis_triggered ? (row.crisis_source ?? "classifier") : "none",
    },
    created_at: row.created_at,
  }));

  return NextResponse.json({ reflections });
}
