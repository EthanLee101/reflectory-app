import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Entry } from "@/lib/types";
import { ENTRIES_PAGE_SIZE } from "@/lib/constants";
import { logError } from "@/lib/logger";
import Navbar from "@/components/Navbar";
import JournalClient from "@/components/JournalClient";

export default async function JournalPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Middleware also guards this, but check here so the type is narrowed.
  if (!user) redirect("/login");

  const { data, error } = await supabase
    .from("entries")
    .select("id, user_id, content, themes, created_at")
    .order("created_at", { ascending: false })
    .limit(ENTRIES_PAGE_SIZE + 1);

  if (error) logError("JournalPage: initial entries fetch", error);

  const page = data ?? [];
  const hasMore = page.length > ENTRIES_PAGE_SIZE;
  const entries = hasMore ? page.slice(0, ENTRIES_PAGE_SIZE) : page;
  const nextCursor = hasMore ? entries[entries.length - 1].created_at : null;

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
      <div className="relative">
        <Navbar userEmail={user.email ?? ""} />
        <div className="mx-auto max-w-5xl px-6 py-12 lg:py-16">
          <JournalClient
            initialEntries={entries as Entry[]}
            initialNextCursor={nextCursor}
            initialEntriesError={
              error ? "Couldn't load your entries. Please refresh the page." : null
            }
          />
        </div>
      </div>
    </main>
  );
}
