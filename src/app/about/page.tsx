import { createClient } from "@/lib/supabase/server";
import Navbar from "@/components/Navbar";

export default async function AboutPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <main className="relative min-h-screen overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 800px 500px at 10% 0%, rgba(217,162,76,0.10), transparent 60%)",
        }}
      />
      <div className="relative">
        <Navbar userEmail={user?.email ?? undefined} />

        <div className="mx-auto max-w-2xl px-6 py-16">
          <div className="text-xs font-bold uppercase tracking-[0.22em] text-accent">
            About
          </div>
          <h1 className="mb-6 mt-2.5 font-serif text-4xl italic text-foreground">
            A journal that actually remembers what you wrote
          </h1>

          <div className="space-y-10 text-[15px] leading-relaxed text-muted">
            <section className="space-y-3">
              <h2 className="font-serif text-xl italic text-foreground">
                Why this exists
              </h2>
              <p>
                Reflectory is a warm, judgment-free space to write —
                inspired by wellbeing apps that lean on human coaches, but
                built the other way around: here, an AI companion is the
                differentiator. It doesn&apos;t replace a person you can talk
                to. It reflects, on request, using the one thing only your
                journal has: your own history.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="font-serif text-xl italic text-foreground">
                How &ldquo;Reflect on this&rdquo; works
              </h2>
              <p>
                A plain journal plus a stock AI call gives generic advice.
                Instead, when you press{" "}
                <span className="text-accent-strong">Reflect on this</span>,
                the app embeds what you just wrote and searches your past
                entries for the ones most relevant to it — a technique called
                retrieval-augmented generation (RAG). The reflection it
                returns is grounded in what it finds, so it can notice things
                like &ldquo;this echoes what you wrote a few weeks ago.&rdquo;
                You can always see exactly which past entries it drew on.
              </p>
              <p>
                Reflection is never automatic. It only happens when you ask
                for it — simpler, more honest about what the AI is doing, and
                entirely on your terms.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="font-serif text-xl italic text-foreground">
                Safety first
              </h2>
              <p>
                Every entry and every reflection request is checked for signs
                of real distress. If something concerning comes up, Journal
                Buddy doesn&apos;t try to counsel you through it — it hands
                off to real, current crisis resources instead. A dependable
                simple safeguard beats a clever one that might fail quietly.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="font-serif text-xl italic text-foreground">
                Your data
              </h2>
              <p>
                Entries are private to your account, enforced at the database
                level so one user&apos;s writing is never visible to another.
              </p>
            </section>
          </div>

          <p className="mt-12 max-w-sm border-l-2 border-border pl-3.5 text-sm leading-relaxed text-faint">
            Reflectory is not a crisis service or a substitute for
            professional care. If you&apos;re in distress, it will point you
            to real support.
          </p>
        </div>
      </div>
    </main>
  );
}
