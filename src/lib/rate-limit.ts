import type { SupabaseClient } from "@supabase/supabase-js";
import { logError } from "@/lib/logger";

type RouteKey = "entries:write" | "reflect" | "search";

/**
 * Per-route limits. Generous for real journaling use, but bound a scripted
 * burst to a small, fixed number of paid Gemini calls.
 */
const LIMITS: Record<RouteKey, { limit: number; windowSeconds: number }> = {
  "entries:write": { limit: 20, windowSeconds: 300 },
  reflect: { limit: 15, windowSeconds: 300 },
  // Search is a single embed + pgvector RPC (cheaper than reflect), so it
  // gets a more generous budget.
  search: { limit: 30, windowSeconds: 300 },
};

/**
 * Postgres-backed rate limit check (atomic, correct across serverless
 * instances/cold starts — see check_rate_limit in supabase/schema.sql).
 *
 * Fails OPEN on an unexpected RPC error — mirrors detectCrisis's fail-open
 * philosophy: an outage in an auxiliary protection check shouldn't block the
 * core feature. If Postgres is unreachable, every other route (which also
 * depends on it) is already down anyway.
 */
export async function checkRateLimit(
  supabase: SupabaseClient,
  route: RouteKey
): Promise<boolean> {
  const { limit, windowSeconds } = LIMITS[route];
  const { data, error } = await supabase.rpc("check_rate_limit", {
    p_route: route,
    p_limit: limit,
    p_window_seconds: windowSeconds,
  });

  if (error) {
    logError("checkRateLimit", error, { forRoute: route });
    return true;
  }

  return data === true;
}
