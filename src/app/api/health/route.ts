import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { logError } from "@/lib/logger";

/**
 * GET /api/health — unauthenticated liveness/DB-connectivity check.
 * Runs a trivial real Postgres round-trip (not just "is the static shell
 * served") so an external uptime monitor catches a DB outage, not just a
 * dead server. Safe to expose: `entries` grants anon select but RLS still
 * scopes every row to auth.uid(), so an anonymous caller always sees zero
 * rows regardless of what's in the table.
 */
export async function GET() {
  const supabase = await createClient();
  const { error } = await supabase.from("entries").select("id").limit(1);

  if (error) {
    logError("GET /api/health", error);
    return NextResponse.json({ status: "error" }, { status: 500 });
  }

  return NextResponse.json({ status: "ok" });
}
