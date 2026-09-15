# Build Handoff — Journal Buddy (Rebuild) MVP

## What This Is

A full-stack AI journaling companion in the spirit of a wellbeing app like Soluna
— a warm, simple, judgment-free space to journal — but with the AI as the
differentiator. Where Soluna deliberately relies on human coaches ("you'll always
reach a real person — not a bot"), this app's core feature is an AI reflection
companion grounded in the user's own journal history via RAG, plus a responsible
crisis-resource hand-off.

This is a full restart of the original Journal Buddy, built properly this time.

## Guiding Principles

- **Honest substance over inflated metrics.** This MVP earns bullets about what
  was built and how (architecture, RAG, safety design) — not about users,
  retention, or uptime that don't exist yet. No invented numbers, ever.
- **Applied-LLM focus.** This project is the applied-LLM half of the two-project
  plan. All AI here is hosted-LLM + RAG. Custom ML modeling belongs to the other
  project (the adaptive tutor), not here.
- **Ship the thesis, cut everything else.** The demo must prove one idea: "a
  journal that safely reflects on your history." Anything not serving that is out
  of scope.
- **Safety is a first-class feature, not an afterthought** — because the domain
  demands it, and because it's a mature thing to have built.

## Tech Stack (locked)

| Layer        | Choice                       | Rationale                                                                                   |
| ------------ | ---------------------------- | ------------------------------------------------------------------------------------------- |
| Frontend     | Next.js + TypeScript (React) | Known stack; SSR; collapses frontend + API into one deployable app.                         |
| Backend      | Next.js API routes           | No separate service to build/deploy; ample for MVP-scale LLM calls and CRUD.                |
| DB + Auth    | Supabase (Postgres, auth, RLS) | Auth + DB + row-level security in one; RLS is a real answer to "how is sensitive data protected." |
| Vector store | pgvector (in Supabase)       | Keeps everything in one database — no extra service; credible RAG retrieval.                |
| LLM          | OpenAI API                   | Fast to build, strong quality; the applied-LLM learning target.                             |
| Hosting      | Vercel + Supabase            | Two managed services, near-zero ops, both free-tier friendly.                               |

## MVP Scope

### Must-have (the demo does not exist without these)

- **Auth** — sign up / log in via Supabase. Makes entries per-user and RLS real.
- **Journaling** — create, save, and view past entries. The core object.
- **AI reflection with RAG** — the heart of the product. On explicit user request
  (a "Reflect on this" button — NOT automatic), the AI returns a reflective
  response grounded in the user's relevant past entries, retrieved via pgvector.
- **Crisis-resource routing** — detect distress signals and surface real crisis
  resources instead of having the AI handle them. Keyword + LLM-classifier check
  that shows a resource banner / hand-off. A dependable simple version beats a
  fragile clever one.

### Out of scope for the MVP (future work)

- Peer community / social features
- Human coaching / counseling
- Guided-prompt generation, breathwork, drawing board, goals tracking
- Mood logging + mood/theme insight dashboards (first post-MVP add)
- Mobile app (web only)
- Real users / scaled deployment
- Any custom emotion/sentiment ML model (that belongs to the tutor project)

## Key Design Decisions (already made — don't relitigate mid-build)

- **Reflection is user-requested, not automatic.** Simpler, more demoable.
- **RAG is minimal but real.** One vector store (pgvector), simple chunking,
  retrieve top-k relevant past entries to ground the reflection.
- **Crisis routing is simple but real.** Keyword + LLM-classifier → resource
  banner. Don't attempt to counsel through a crisis in-app.

## Suggested Build Order

1. **Scaffold** — Next.js + TypeScript app, deploy an empty shell to Vercel early.
2. **Supabase setup** — project, auth, entries table, enable RLS. Verify isolation
   with two test accounts.
3. **Journaling CRUD** — write / save / list / view entries behind auth.
4. **Embeddings + pgvector** — on entry save, generate an embedding and store it;
   enable pgvector and a similarity query.
5. **RAG reflection** — "Reflect on this" → retrieve top-k → grounded prompt →
   OpenAI → display.
6. **Crisis routing** — classifier check → resource banner with real resources.
7. **Polish for demo** — clean reflection UI, warm/non-clinical system prompt,
   make RAG grounding visibly working.

## Honest Resume Bullets This MVP Earns

- Built a full-stack AI journaling companion in Next.js/TypeScript with Supabase
  auth and Postgres row-level security for per-user data isolation.
- Engineered a RAG pipeline using pgvector and the OpenAI API to ground AI
  reflections in a user's relevant past journal entries.
- Designed crisis-detection and safe hand-off logic to route users in distress to
  human support resources, building safety in as a first-class feature.

## Notes / Watch-outs

- **Tone matters.** Invest in the system prompt: warm, non-judgmental, explicitly
  non-clinical.
- **Verify RLS for real.** Test with two accounts.
- **Get the crisis resources right and current** before anyone real touches it.
- **Deploy early, deploy often.**
- **Push to a public GitHub repo.**
