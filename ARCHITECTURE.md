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

## Data protection

Entries live in Supabase Postgres with Row-Level Security enabled, so a
user can only read or write their own rows at the database layer, not just
in application code. This was verified directly by testing with two
separate accounts and confirming neither could see the other's entries.

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
