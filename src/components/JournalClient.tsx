"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Entry, ReflectResponse } from "@/lib/types";
import { MAX_ENTRY_LENGTH } from "@/lib/constants";
import CrisisBanner from "@/components/CrisisBanner";

export default function JournalClient({
  initialEntries,
  userEmail,
}: {
  initialEntries: Entry[];
  userEmail: string;
}) {
  const router = useRouter();
  const supabase = createClient();

  const [entries, setEntries] = useState<Entry[]>(initialEntries);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [crisis, setCrisis] = useState(false);

  // Reflection state, keyed by the entry being reflected on.
  const [reflectingId, setReflectingId] = useState<string | null>(null);
  const [reflection, setReflection] = useState<ReflectResponse | null>(null);
  // Which entry the current reflection belongs to.
  const [reflectedFor, setReflectedFor] = useState<string | null>(null);

  // Inline edit state, keyed by the entry being edited.
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function saveEntry(e: React.FormEvent) {
    e.preventDefault();
    if (!draft.trim()) return;
    setSaving(true);
    setCrisis(false);

    const res = await fetch("/api/entries", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: draft }),
    });

    setSaving(false);
    if (!res.ok) return;

    const { entry, crisis: crisisResult } = await res.json();
    setEntries([entry as Entry, ...entries]);
    setDraft("");
    if (crisisResult?.triggered) setCrisis(true);
  }

  async function reflect(entry: Entry) {
    setReflectingId(entry.id);
    setReflection(null);
    setReflectedFor(null);
    setCrisis(false);

    const res = await fetch("/api/reflect", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ entryId: entry.id, content: entry.content }),
    });

    if (!res.ok) {
      setReflectingId(null);
      return;
    }

    const data = (await res.json()) as ReflectResponse;
    setReflection(data);
    setReflectedFor(entry.id);
    setReflectingId(null);
    if (data.crisis?.triggered) setCrisis(true);
  }

  function startEdit(entry: Entry) {
    setEditingId(entry.id);
    setEditDraft(entry.content);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditDraft("");
  }

  async function saveEdit(entry: Entry) {
    if (!editDraft.trim()) return;
    setSavingEdit(true);

    const res = await fetch(`/api/entries/${entry.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: editDraft }),
    });

    setSavingEdit(false);
    if (!res.ok) return;

    const { entry: updated, crisis: crisisResult } = await res.json();
    setEntries(entries.map((e) => (e.id === entry.id ? (updated as Entry) : e)));
    setEditingId(null);
    setEditDraft("");
    if (crisisResult?.triggered) setCrisis(true);
    if (reflectedFor === entry.id) {
      setReflection(null);
      setReflectedFor(null);
    }
  }

  async function deleteEntry(entry: Entry) {
    if (!window.confirm("Delete this entry? This can't be undone.")) return;
    setDeletingId(entry.id);

    const res = await fetch(`/api/entries/${entry.id}`, { method: "DELETE" });

    setDeletingId(null);
    if (!res.ok) return;

    setEntries(entries.filter((e) => e.id !== entry.id));
    if (reflectedFor === entry.id) {
      setReflection(null);
      setReflectedFor(null);
    }
  }

  async function signOut() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="space-y-8">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Your journal</h1>
        <div className="flex items-center gap-3 text-sm text-foreground/60">
          <span>{userEmail}</span>
          <button onClick={signOut} className="underline underline-offset-4">
            Sign out
          </button>
        </div>
      </header>

      {crisis && <CrisisBanner />}

      <form onSubmit={saveEntry} className="space-y-3">
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="What's on your mind today?"
          rows={5}
          maxLength={MAX_ENTRY_LENGTH}
          className="w-full rounded-xl border border-foreground/15 bg-white p-4 outline-none focus:border-foreground/40"
        />
        <div className="flex items-center justify-between">
          <button
            type="submit"
            disabled={saving || !draft.trim()}
            className="rounded-full bg-foreground px-5 py-2 text-background transition hover:opacity-90 disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save entry"}
          </button>
          <span className="text-xs text-foreground/40">
            {draft.length}/{MAX_ENTRY_LENGTH}
          </span>
        </div>
      </form>

      <section className="space-y-4">
        {entries.length === 0 && (
          <p className="text-foreground/50">
            No entries yet. Your first one is above.
          </p>
        )}

        {entries.map((entry) =>
          editingId === entry.id ? (
            <article
              key={entry.id}
              className="rounded-xl border border-foreground/10 bg-white p-4"
            >
              <textarea
                value={editDraft}
                onChange={(e) => setEditDraft(e.target.value)}
                rows={5}
                maxLength={MAX_ENTRY_LENGTH}
                className="w-full rounded-xl border border-foreground/15 bg-white p-4 outline-none focus:border-foreground/40"
              />
              <div className="mt-3 flex items-center justify-between text-xs text-foreground/40">
                <span>
                  {editDraft.length}/{MAX_ENTRY_LENGTH}
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={cancelEdit}
                    disabled={savingEdit}
                    className="rounded-full border border-foreground/20 px-3 py-1 text-foreground/70 transition hover:bg-foreground/5 disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => saveEdit(entry)}
                    disabled={savingEdit || !editDraft.trim()}
                    className="rounded-full bg-foreground px-3 py-1 text-background transition hover:opacity-90 disabled:opacity-50"
                  >
                    {savingEdit ? "Saving…" : "Save"}
                  </button>
                </div>
              </div>
            </article>
          ) : (
            <article
              key={entry.id}
              className="rounded-xl border border-foreground/10 bg-white p-4"
            >
              <p className="whitespace-pre-wrap">{entry.content}</p>
              <div className="mt-3 flex items-center justify-between text-xs text-foreground/40">
                <time>{new Date(entry.created_at).toLocaleString()}</time>
                <div className="flex gap-2">
                  <button
                    onClick={() => startEdit(entry)}
                    className="rounded-full border border-foreground/20 px-3 py-1 text-foreground/70 transition hover:bg-foreground/5"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => deleteEntry(entry)}
                    disabled={deletingId === entry.id}
                    className="rounded-full border border-foreground/20 px-3 py-1 text-foreground/70 transition hover:bg-foreground/5 disabled:opacity-50"
                  >
                    {deletingId === entry.id ? "Deleting…" : "Delete"}
                  </button>
                  <button
                    onClick={() => reflect(entry)}
                    disabled={reflectingId === entry.id}
                    className="rounded-full border border-foreground/20 px-3 py-1 text-foreground/70 transition hover:bg-foreground/5 disabled:opacity-50"
                  >
                    {reflectingId === entry.id ? "Reflecting…" : "Reflect on this"}
                  </button>
                </div>
              </div>

              {reflection && reflectedFor === entry.id && (
                <ReflectionPanel data={reflection} />
              )}
            </article>
          )
        )}
      </section>
    </div>
  );
}

/**
 * Renders the reflection under the entry it was generated for, plus the past
 * entries used to ground it — so the RAG is visibly working.
 */
function ReflectionPanel({ data }: { data: ReflectResponse }) {
  return (
    <div className="mt-4 space-y-3 rounded-lg bg-foreground/5 p-4">
      <p className="whitespace-pre-wrap text-sm">{data.reflection}</p>
      {data.grounding.length > 0 && (
        <details className="text-xs text-foreground/50">
          <summary className="cursor-pointer">
            Grounded in {data.grounding.length} past{" "}
            {data.grounding.length === 1 ? "entry" : "entries"}
          </summary>
          <ul className="mt-2 space-y-1">
            {data.grounding.map((g) => (
              <li key={g.id}>
                {new Date(g.created_at).toLocaleDateString()} —{" "}
                {g.content.slice(0, 80)}
                {g.content.length > 80 ? "…" : ""}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
