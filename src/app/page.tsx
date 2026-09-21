import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import Navbar from "@/components/Navbar";

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <main className="relative min-h-screen overflow-hidden">
      {/* atmosphere */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 900px 560px at 85% -10%, rgba(217,162,76,0.16), transparent 60%), radial-gradient(ellipse 700px 700px at 5% 110%, rgba(217,162,76,0.09), transparent 60%)",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute right-[-120px] top-24 hidden h-[560px] w-[560px] lg:block"
      >
        <div
          className="absolute right-[120px] top-[120px] h-[320px] w-[320px] animate-[flicker_7s_ease-in-out_infinite] rounded-full blur-[2px]"
          style={{ background: "radial-gradient(circle, rgba(217,162,76,0.32) 0%, rgba(217,162,76,0.10) 45%, transparent 70%)" }}
        />
        <div className="absolute right-[220px] top-[220px] h-[130px] w-[130px] rounded-full border border-accent/25" />
        <div className="absolute right-[170px] top-[170px] h-[230px] w-[230px] rounded-full border border-accent/15" />
      </div>

      <div className="relative">
        <Navbar userEmail={user?.email ?? undefined} />
      </div>

      <div className="relative mx-auto flex min-h-[calc(100vh-73px)] max-w-4xl flex-col justify-center gap-7 px-6 py-20 lg:items-start lg:px-16">
        <div
          className="animate-[fade-rise_0.7s_ease-out_both] text-xs font-bold uppercase tracking-[0.22em] text-accent"
          style={{ animationDelay: "0ms" }}
        >
          Write. Reflect. Repeat.
        </div>

        <h1
          className="animate-[fade-rise_0.7s_ease-out_both] font-serif text-6xl font-extrabold leading-[0.94] tracking-tight sm:text-7xl lg:text-8xl"
          style={{ animationDelay: "90ms" }}
        >
          <span>Reflect</span>
          <span className="font-medium italic text-accent-strong">ory</span>
        </h1>

        <p
          className="animate-[fade-rise_0.7s_ease-out_both] max-w-lg text-xl leading-relaxed text-muted"
          style={{ animationDelay: "180ms" }}
        >
          A warm, judgment-free space to journal — with an AI companion that
          reflects on your own history, only when you ask it to.
        </p>

        <Link
          href={user ? "/journal" : "/login"}
          className="animate-[fade-rise_0.7s_ease-out_both] mt-2 inline-flex w-fit items-center gap-2 rounded-full bg-accent px-7 py-4 font-bold text-accent-ink shadow-[0_8px_30px_rgba(217,162,76,0.35)] transition hover:opacity-90"
          style={{ animationDelay: "270ms" }}
        >
          {user ? "Open your journal" : "Get started"}
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12h14" />
            <path d="M13 6l6 6-6 6" />
          </svg>
        </Link>

        <p className="mt-8 max-w-sm border-l-2 border-border pl-3.5 text-sm leading-relaxed text-faint">
          Reflectory is not a crisis service or a substitute for
          professional care. If you&apos;re in distress, it will point you to
          real support.
        </p>
      </div>
    </main>
  );
}
