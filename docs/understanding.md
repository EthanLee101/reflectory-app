# Journal Buddy — Shared Understanding

A conversation-style summary of what this app is, to keep everyone (and future
me) aligned on the thesis before writing more code.

---

**Q: In one sentence, what is Journal Buddy?**

A warm, judgment-free journaling web app whose differentiator is an AI reflection
companion that grounds its responses in your _own_ past entries (via RAG), with a
responsible crisis-resource hand-off built in as a first-class safety feature.

**Q: How is this different from a wellbeing app like Soluna?**

Soluna deliberately keeps a human in the loop — "you'll always reach a real
person, not a bot." Journal Buddy inverts that: the _AI is the product_. But it
borrows Soluna's warmth and simplicity, and it does _not_ pretend the AI can
counsel someone in crisis — that's what the crisis routing is for. "AI as
differentiator" plus "humility about the AI's limits."

**Q: Why does the RAG matter? Couldn't you just send the entry to GPT?**

RAG is the whole thesis. A plain journal + a stock LLM call gives generic advice.
Here, when you hit "Reflect on this," the app embeds your entry, does a similarity
search over your past entries in pgvector, retrieves the top-k relevant ones, and
composes a prompt grounded in _your_ history — so the reflection can say "this
echoes what you wrote a few weeks ago about work stress." That visible grounding
is what proves the thesis and is the applied-LLM learning goal.

**Q: Is reflection automatic?**

No — deliberately user-requested. A "Reflect on this" button, never automatic.
Locked decision: simpler, more demoable, far less prompt-tuning than always-on.

**Q: How does crisis handling work, and what's the philosophy?**

Simple but real. A keyword check plus an LLM classifier on the input; if distress
is detected, the app surfaces a banner with real, current crisis resources and
does _not_ have the AI try to counsel through it. Rule: "a dependable simple
version beats a fragile clever one." Safety is a feature you built, not a
disclaimer bolted on.

**Q: What's the data-protection story?**

Supabase Postgres with Row-Level Security. Every entry is per-user, and RLS
policies enforce that a user can only read/write their own rows — verified with
two test accounts. Both the privacy baseline and an honest resume claim.

**Q: Why this exact stack?**

Next.js + TypeScript collapses frontend and backend API into one deployable.
Supabase gives auth + Postgres + RLS + pgvector in one service, so RAG needs no
extra infrastructure. OpenAI for embeddings and generation. Vercel + Supabase for
near-zero-ops, free-tier-friendly hosting. All locked.

**Q: What is explicitly _out_ of scope?**

Peer/social features, human coaching, guided prompts / breathwork / drawing /
goals, mood-logging dashboards (deferred as the _first_ post-MVP add), a mobile
app, real/scaled users, and any custom sentiment/emotion ML model — that ML
flavor belongs to the _other_ project (the adaptive tutor). This is the
applied-LLM half: hosted LLM + RAG only.

**Q: What does "done" look like for the MVP demo?**

Five things work end to end: (1) auth, (2) create/save/view entries behind auth
with RLS, (3) "Reflect on this" → pgvector retrieval → grounded reflection that
visibly references past themes, (4) crisis detection → resource banner, (5)
deployed on Vercel, not just localhost. Plus a warm, explicitly non-clinical tone.

**Q: Guiding principle for how you talk about it?**

Honest substance over inflated metrics. No invented users, retention, or uptime.
The bullets earned are about _what was built and how_.
