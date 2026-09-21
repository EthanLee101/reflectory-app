# Production readiness

Reflectory already handles the code-side of production readiness: per-user
rate limiting, request timeouts, idempotency on the two most consequential
writes, cursor pagination, DB indexing, structured error logging, and a
`/api/health` endpoint (see the main [`README.md`](../README.md) and
[`ARCHITECTURE.md`](../ARCHITECTURE.md) for the design rationale).

The items below can't be done from application code — they're steps to take
in Vercel/Supabase/Google's consoles, or to run by hand.

## 1. Uptime monitoring

Point a free monitor at `/api/health` (it does a real Postgres round-trip,
not just "is the static shell served" — see `src/app/api/health/route.ts`).

1. Create a free account at [UptimeRobot](https://uptimerobot.com) or
   [Better Stack](https://betterstack.com/uptime).
2. Add an HTTP(S) monitor for `https://<your-deployed-url>/api/health`.
3. Set the check interval to 5 minutes (fine for a personal project) and
   configure an alert contact (email is enough) so a DB outage or deploy
   failure reaches you.
4. A healthy response is `{"status":"ok"}` with a 200 status; a 500 means the
   DB round-trip failed.

## 2. Gemini/Vertex billing cap

The app already caps output tokens on the main reflection call
(`MAX_REFLECTION_OUTPUT_TOKENS` in `src/lib/constants.ts`) and rate-limits
requests per user, but neither of those is a hard dollar ceiling. Set one at
the provider level:

1. Go to [Google AI Studio](https://aistudio.google.com) (or the
   [Vertex AI console](https://console.cloud.google.com/vertex-ai) if the key
   is provisioned through a GCP project).
2. Open the billing/quota settings for the project tied to `GEMINI_API_KEY`.
3. Set a hard daily or monthly spend cap and a budget alert threshold (e.g.
   50%/90%/100% of the cap) so you're notified before it's hit.

## 3. Supabase backup-restore test

Don't test a restore against the production project. Instead:

1. Create a separate, throwaway Supabase project (or use Supabase's branching
   feature if available on your plan).
2. Trigger a restore from a recent backup/PITR snapshot into that project via
   Settings → Database → Backups.
3. Once restored, connect to it and confirm a known journal entry (content,
   `created_at`, embedding, RLS policies) round-trips correctly.
4. Delete the throwaway project when done.

This is worth doing once to confirm the restore flow actually works, and
periodically re-checking (e.g. before a major schema change) rather than
assuming backups are restorable without ever having tried.

## 4. Concurrent-usage sanity check

The realistic risk here is two things: RLS isolation (one user's session
should never see another's rows) and the per-user rate limiter (one user
hammering the API shouldn't affect anyone else's budget). Both are best
verified end-to-end rather than with synthetic load:

1. Sign in as 2-3 separate test accounts in separate browser profiles or
   incognito windows.
2. Journal simultaneously from each — create, edit, delete, search, and
   reflect — and confirm no account ever sees another's entries or
   reflections.
3. From one account, fire off requests quickly enough to trip the rate
   limiter (`entries:write` is 20/300s, `reflect` is 15/300s, `search` is
   30/300s — see `src/lib/rate-limit.ts`) and confirm the other accounts are
   unaffected.

As an optional stretch, `npx autocannon https://<your-deployed-url>/api/health`
gives a quick scripted load sample against the unauthenticated health
endpoint (no cookie/session handling needed) — useful as a smoke test, but
not a substitute for the RLS/rate-limit check above, which exercises the
real authenticated code paths.
