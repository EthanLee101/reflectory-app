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
    <main className="mx-auto max-w-2xl px-6 py-10">
      <JournalClient
        initialEntries={(entries ?? []) as Entry[]}
        userEmail={user.email ?? ""}
      />
    </main>
  );
}
