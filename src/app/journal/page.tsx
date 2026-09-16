import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Entry } from "@/lib/types";
import JournalClient from "@/components/JournalClient";

export default async function JournalPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Middleware also guards this, but check here so the type is narrowed.
  if (!user) redirect("/login");

  const { data: entries } = await supabase
    .from("entries")
    .select("id, user_id, content, created_at")
    .order("created_at", { ascending: false });

  return (
    <main className="relative min-h-screen overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 800px 500px at 90% 0%, rgba(217,162,76,0.10), transparent 60%)",
        }}
      />
      <div className="relative mx-auto max-w-2xl px-6 py-14">
        <JournalClient
          initialEntries={(entries ?? []) as Entry[]}
          userEmail={user.email ?? ""}
        />
      </div>
    </main>
  );
}
