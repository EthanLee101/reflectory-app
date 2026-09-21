import type { SupabaseClient } from "@supabase/supabase-js";
import { logError } from "@/lib/logger";

type ClaimResult =
  | { replay: false }
  | { replay: true; response: unknown; statusCode: number }
  | { replay: "conflict" };

/**
 * Claims an idempotency key for a route, so a network retry or race replaying
 * the same logical submission (not a user double-clicking — the client
 * already disables the button while a request is in flight) doesn't re-run
 * its side effects: inserting a duplicate entry, or triggering a second paid
 * Gemini call.
 *
 * `{ replay: false }` — fresh request, the caller should process it normally.
 * `{ replay: true, response, statusCode }` — an earlier completed request
 * with this key should just be replayed verbatim.
 * `{ replay: "conflict" }` — an identical request is still in flight, or a
 * prior attempt never completed; the caller should return 409.
 */
export async function claimIdempotencyKey(
  supabase: SupabaseClient,
  key: string,
  route: string,
  ttlSeconds = 300
): Promise<ClaimResult> {
  const { data: inserted, error: insertError } = await supabase
    .from("idempotency_keys")
    .upsert({ key, route }, { onConflict: "user_id,key", ignoreDuplicates: true })
    .select("key")
    .maybeSingle();

  if (insertError) {
    // Fail open: an outage in this auxiliary protection shouldn't block the
    // core feature, mirroring checkRateLimit's fail-open philosophy.
    logError("claimIdempotencyKey", insertError, { forRoute: route });
    return { replay: false };
  }

  if (inserted) return { replay: false };

  const { data: existing, error: selectError } = await supabase
    .from("idempotency_keys")
    .select("status, response, status_code, created_at")
    .eq("key", key)
    .eq("route", route)
    .maybeSingle();

  if (selectError || !existing) {
    logError("claimIdempotencyKey", selectError, {
      route,
      note: "lookup after conflict failed",
    });
    return { replay: false };
  }

  const ageSeconds =
    (Date.now() - new Date(existing.created_at).getTime()) / 1000;

  if (existing.status === "done" && ageSeconds <= ttlSeconds) {
    return {
      replay: true,
      response: existing.response,
      statusCode: existing.status_code ?? 200,
    };
  }

  return { replay: "conflict" };
}

/** Marks a claimed key as done, storing the response so a replay can return it. */
export async function completeIdempotencyKey(
  supabase: SupabaseClient,
  key: string,
  route: string,
  response: unknown,
  statusCode: number
) {
  const { error } = await supabase
    .from("idempotency_keys")
    .update({ status: "done", response, status_code: statusCode })
    .eq("key", key)
    .eq("route", route);
  if (error) logError("completeIdempotencyKey", error, { forRoute: route });
}

/** Best-effort cleanup on the error path, so a failed request can be retried with the same key. */
export async function releaseIdempotencyKey(
  supabase: SupabaseClient,
  key: string,
  route: string
) {
  const { error } = await supabase
    .from("idempotency_keys")
    .delete()
    .eq("key", key)
    .eq("route", route);
  if (error) logError("releaseIdempotencyKey", error, { forRoute: route });
}
