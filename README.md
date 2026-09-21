# Reflectory

A warm, judgment-free AI journaling companion. You write; when you ask, it
reflects on your entry **grounded in your own past entries** (RAG over pgvector),
and routes you to real crisis resources if it detects distress.

See [`ARCHITECTURE.md`](ARCHITECTURE.md) for the design decisions and
rationale behind the RAG pipeline, the crisis-routing philosophy, and the
tech stack choices.

## Stack

- **Next.js + TypeScript** (App Router) — frontend + API routes in one deployable
- **Supabase** — Postgres, Auth, Row-Level Security
- **pgvector** — embedding storage + similarity search, inside Supabase
- **Google Gemini API** — embeddings + reflection generation
- **Vercel + Supabase** — hosting

## Getting started

1. **Install dependencies**

   ```bash
   npm install
   ```

2. **Create a Supabase project**, then run [`supabase/schema.sql`](supabase/schema.sql)
   in the SQL editor. This creates the `entries` table, enables pgvector, sets up
   RLS policies, and defines the retrieval + rate-limiting functions.

3. **Configure environment variables**

   ```bash
   cp .env.example .env.local
   ```

   Fill in your Supabase URL + keys and your Gemini API key.

4. **Run the dev server**

   ```bash
   npm run dev
   ```

   Open http://localhost:3000.

## Verifying the privacy guarantee (RLS)

Sign up with two accounts, write an entry in each, and confirm neither can see
the other's entries. This is the core privacy baseline — test it for real.

## Project layout

```
src/
  app/
    page.tsx              Landing page
    about/                 How the RAG + crisis-safety design works
    login/                 Auth (sign in / sign up)
    journal/               The journaling UI (server + client)
    api/
      entries/              Create, list (paginated), edit, delete entries
      reflect/               RAG reflection endpoint
      health/                 Unauthenticated DB-connectivity check
  components/
    Navbar.tsx              Site navigation + auth state
    JournalClient.tsx        Entries state/orchestration
    EntryComposer.tsx        New-entry form
    EntryCard.tsx             View/edit an entry, triggers reflection
    ReflectionPanel.tsx       Displays a grounded reflection + its sources
    Toast.tsx                  Error toasts for failed requests
    AppTour.tsx                Spotlight walkthrough of the core features
    CrisisBanner.tsx           Crisis-resource hand-off
  lib/
    supabase/                Browser + server + middleware clients
    gemini.ts                 Gemini client
    embeddings.ts              Text → embedding
    rag.ts                      Retrieval + grounded reflection
    crisis.ts                    Keyword + LLM-classifier crisis detection
    crisis-resources.ts           Resources shown on the banner (VERIFY CURRENT)
    rate-limit.ts                  Per-user rate limiting (Postgres RPC-backed)
    idempotency.ts                  Dedupes retried entry/reflect submissions
    logger.ts                        Structured error/warn logging
    types.ts                        Shared types
middleware.ts               Refreshes auth session; guards /journal
supabase/schema.sql         Database schema + RLS + retrieval/rate-limit functions
docs/production-readiness.md Uptime monitoring, billing caps, backup/load testing guide
```

## Status

All MVP milestones are complete: auth, journaling CRUD, RAG-grounded
reflection, crisis routing, rate limiting, and UI polish. Deployed to Vercel

## Production readiness

Beyond the MVP, the app has per-user rate limiting, request timeouts on every
external call, an output-token cap on the paid reflection generation,
idempotency protection on entry creation and reflection generation, cursor
pagination on the entries list, structured error logging, and a
`/api/health` endpoint. See [`docs/production-readiness.md`](docs/production-readiness.md)
for the operational side (uptime monitoring, billing caps, backup-restore and
concurrent-usage testing) that has to happen outside the codebase.

> Not a crisis service or a substitute for professional care.
