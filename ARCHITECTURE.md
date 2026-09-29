# Architecture & Design Decisions

Reflectory is a full-stack AI journaling companion. It is a warm,
judgment-free space to write, with an AI reflection feature as its core
differentiator: on request, it grounds its response in the user's own past
entries via retrieval-augmented generation (RAG), and it hands off to real
crisis resources rather than attempting to counsel a user through a crisis.

## Why RAG, not a plain LLM call

A journal entry sent straight to a stock LLM produces generic advice — the
kind of response that could apply to anyone. The interesting engineering
problem, and the actual value proposition, is grounding the reflection in
the user's own history: when a user asks for a reflection, the app embeds
the entry, runs a similarity search over the user's past entries in
pgvector, retrieves the most relevant ones, and composes a prompt around
that retrieved context. The result can reference real patterns — "this
echoes what you wrote a few weeks ago" — because it's actually reading the
user's history, not guessing at it. The retrieved entries are shown
alongside the reflection so the retrieval step is never a black box.

## Why reflection is user-triggered, not automatic

Reflection only happens when the user presses "Reflect on this" — it is
deliberately never triggered automatically on save. This is simpler to
reason about, easier to demo, and avoids the prompt-tuning burden of an
always-on assistant that has to get every unsolicited response right. It
also keeps the product honest about what it is: a tool the user reaches
for, not an AI that inserts itself into every entry.

## Crisis-resource routing

Every entry and every reflection request passes through a two-layer crisis
check: a fast keyword pass for explicit language, backed by an LLM
classifier that catches distress phrased less directly. If either layer
triggers, the app does not attempt to counsel the user — it surfaces a
banner with real, current crisis resources instead. The guiding principle
is that a dependable simple safeguard beats a clever one that might fail
quietly; safety here is a designed feature, not a disclaimer bolted on
afterward.

## Retrieval details

Retrieved entries must clear a cosine-similarity floor
(`MIN_REFLECTION_SIMILARITY` / `MIN_SEARCH_SIMILARITY` in
`src/lib/constants.ts`) rather than always taking the top-k, so the model is
never handed unrelated entries as "context". The floors are starting points to
tune on real data. When the text being reflected on is exactly the saved entry,
retrieval reuses its stored embedding (`match_entries_for_entry`) instead of
paying for another embed call.

## Data protection

Entries live in Supabase Postgres with Row-Level Security enabled, so a
user can only read or write their own rows at the database layer, not just
in application code. This was verified directly by testing with two
separate accounts and confirming neither could see the other's entries, and is
now also covered by automated tests against a real Postgres (`test/db/`).

The per-user rate-limit table is not directly writable by API roles: the counter
changes only through the `SECURITY DEFINER` `check_rate_limit` function, so a
signed-in user can't reset their own bucket through the REST API. Accepted
residual risk: `entries` and `idempotency_keys` remain directly writable by their
owner (a user can insert their own rows without an embedding, or delete their own
idempotency keys). That affects only the user's own data and triggers no paid
Gemini calls.

### Known limits of the safeguards

- The classifier fails open: if the Gemini call errors (outage, exhausted quota),
  detection falls back to keywords only. The failure is logged (`detectCrisis`)
  so it is visible, and the keyword layer never depends on the network.
- Keyword matching cannot tell topic from intent ("a documentary about suicide
  prevention" triggers it). A false alarm shows a resources banner; a miss is
  worse, so the layer stays conservative in that direction.
- The entry is wrapped in delimiters and the classifier is told to treat it as
  data, which raises the bar for prompt injection but is not a guarantee.
- Measured with `npm run eval:crisis` (labeled cases in
  `src/lib/crisis-eval-cases.ts`). Live-classifier recall: **not yet measured** —
  the first run hit the free-tier quota; record model, date and numbers here
  once run with adequate quota. This is a designed safeguard, not a clinically
  validated one.

## Tech stack and rationale

| Layer        | Choice                          | Why                                                                 |
| ------------ | -------------------------------- | -------------------------------------------------------------------- |
| Frontend     | Next.js + TypeScript (React)     | Collapses frontend and API into one deployable app.                  |
| Backend      | Next.js API routes                | No separate service to build or deploy.                              |
| DB + Auth    | Supabase (Postgres, Auth, RLS)    | Auth, database, and row-level security in one place.                 |
| Vector store | pgvector (in Supabase)            | Real similarity search with no extra infrastructure.                 |
| LLM          | Google Gemini API                 | Embeddings + generation for the RAG pipeline.                        |
| Hosting      | Vercel + Supabase                 | Two managed services, minimal operational overhead.                  |

## Scope decisions

**In scope:** authentication; creating, editing, deleting, and viewing
journal entries; RAG-grounded reflection on request; crisis-resource
routing; per-user rate limiting on writes and reflection requests
(implemented as an atomic Postgres RPC, so it holds up correctly across
Vercel's stateless, multi-instance serverless environment, unlike a
naive in-memory counter).

**Deliberately out of scope:** peer/social features, human coaching,
guided prompts or breathwork, mood-logging dashboards, a mobile app, and
any custom sentiment/emotion ML model — this project is the applied-LLM
half of a larger plan; a custom-model project lives elsewhere. Mood
tracking in particular is treated as a real candidate for future work,
not a rejected idea — it's simply not part of this build.

## What "done" looks like

Five things work end to end: authentication; creating, saving, and viewing
entries behind auth with RLS; "Reflect on this" retrieving from pgvector
and returning a grounded reflection that visibly references past themes;
crisis detection surfacing the resource banner; and a warm, explicitly
non-clinical tone throughout, deployed rather than left on localhost.
