# Journal Buddy

A warm, judgment-free AI journaling companion. You write; when you ask, it
reflects on your entry **grounded in your own past entries** (RAG over pgvector),
and routes you to real crisis resources if it detects distress.

This is the applied-LLM MVP: hosted LLM + RAG, safety as a first-class feature.
See [`docs/understanding.md`](docs/understanding.md) for the thesis and
[`docs/HANDOFF.md`](docs/HANDOFF.md) for the full build handoff.

## Stack

- **Next.js + TypeScript** (App Router) — frontend + API routes in one deployable
- **Supabase** — Postgres, Auth, Row-Level Security
- **pgvector** — embedding storage + similarity search, inside Supabase
- **OpenAI** — embeddings (`text-embedding-3-small`) + reflection generation
- **Vercel + Supabase** — hosting

## Getting started

1. **Install dependencies**

   ```bash
   npm install
   ```

2. **Create a Supabase project**, then run [`supabase/schema.sql`](supabase/schema.sql)
   in the SQL editor. This creates the `entries` table, enables pgvector, sets up
   RLS policies, and defines the `match_entries` retrieval function.

3. **Configure environment variables**

   ```bash
   cp .env.example .env.local
   ```

   Fill in your Supabase URL + anon key and your OpenAI API key.

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
    login/                Auth (sign in / sign up)
    journal/              The journaling UI (server + client)
    api/
      entries/            Create + list entries (embeds on save, crisis-checks)
      reflect/            RAG reflection endpoint
  components/             JournalClient, CrisisBanner
  lib/
    supabase/             Browser + server + middleware clients
    openai.ts             OpenAI client
    embeddings.ts         Text → embedding
    rag.ts                Retrieval + grounded reflection
    crisis.ts             Keyword + LLM-classifier crisis detection
    crisis-resources.ts   Resources shown on the banner (VERIFY CURRENT)
    types.ts              Shared types
middleware.ts             Refreshes auth session; guards /journal
supabase/schema.sql       Database schema + RLS + match_entries()
```

## Build order (from the handoff)

1. ✅ Scaffold
2. Supabase setup + verify RLS with two accounts
3. Journaling CRUD
4. Embeddings + pgvector on save
5. RAG reflection ("Reflect on this")
6. Crisis routing
7. Demo polish (warm tone, visible grounding)

> Not a crisis service or a substitute for professional care.
