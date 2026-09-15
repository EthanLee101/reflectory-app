import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col items-center justify-center gap-8 px-6 text-center">
      <div className="space-y-4">
        <h1 className="text-4xl font-semibold tracking-tight">Journal Buddy</h1>
        <p className="text-lg text-foreground/70">
          A warm, judgment-free space to journal — with an AI companion that
          reflects on your own history when you ask it to.
        </p>
      </div>

      <Link
        href={user ? "/journal" : "/login"}
        className="rounded-full bg-foreground px-6 py-3 text-background transition hover:opacity-90"
      >
        {user ? "Open your journal" : "Get started"}
      </Link>

      <p className="max-w-md text-sm text-foreground/50">
        Journal Buddy is not a crisis service or a substitute for professional
        care. If you&apos;re in distress, it will point you to real support.
      </p>
    </main>
  );
}
