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
    <div className="space-y-7">
      <header className="flex items-center justify-between">
        <h1 className="font-serif text-2xl italic text-foreground">
          Journal Buddy
        </h1>
        <div className="flex items-center gap-4 text-sm text-faint">
          <span>{userEmail}</span>
          <button
            onClick={signOut}
            className="text-muted underline underline-offset-4"
          >
            Sign out
          </button>
        </div>
      </header>

      {crisis && <CrisisBanner />}

      <form
        onSubmit={saveEntry}
        className="rounded-sm border border-border-soft bg-gradient-to-br from-surface to-surface-2 p-6 shadow-[0_24px_50px_rgba(0,0,0,0.35)]"
      >
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="What's on your mind today?"
          rows={4}
          maxLength={MAX_ENTRY_LENGTH}
          className="w-full resize-none border-b border-border-soft bg-transparent pb-6 text-[15px] text-foreground outline-none placeholder:font-serif placeholder:text-base placeholder:italic placeholder:text-faint"
        />
        <div className="mt-4 flex items-center justify-between">
          <button
            type="submit"
            disabled={saving || !draft.trim()}
            className="rounded-full bg-accent px-6 py-2.5 text-sm font-bold text-accent-ink transition hover:opacity-90 disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save entry"}
          </button>
          <span className="text-xs text-faint">
            {draft.length}/{MAX_ENTRY_LENGTH}
          </span>
        </div>
      </form>

      <section className="space-y-4">
        {entries.length === 0 && (
          <p className="text-faint">No entries yet. Your first one is above.</p>
        )}

        {entries.map((entry) =>
          editingId === entry.id ? (
            <article
              key={entry.id}
              className="rounded-sm border border-border-soft bg-surface p-5"
            >
              <textarea
                value={editDraft}
                onChange={(e) => setEditDraft(e.target.value)}
                rows={5}
                maxLength={MAX_ENTRY_LENGTH}
                className="w-full resize-none rounded-sm border border-border bg-transparent p-3 text-[15px] text-foreground outline-none focus:border-accent"
              />
              <div className="mt-3 flex items-center justify-between text-xs text-faint">
                <span>
                  {editDraft.length}/{MAX_ENTRY_LENGTH}
                </span>
                <div className="flex gap-2">
                  <ActionPill onClick={cancelEdit} disabled={savingEdit}>
                    Cancel
                  </ActionPill>
                  <button
                    onClick={() => saveEdit(entry)}
                    disabled={savingEdit || !editDraft.trim()}
                    className="rounded-full bg-accent px-3.5 py-1.5 text-xs font-bold text-accent-ink transition hover:opacity-90 disabled:opacity-50"
                  >
                    {savingEdit ? "Saving…" : "Save"}
                  </button>
                </div>
              </div>
            </article>
          ) : (
            <article
              key={entry.id}
              className="rounded-sm border border-border-soft bg-surface p-5"
            >
              <p className="whitespace-pre-wrap text-[15px] leading-relaxed text-foreground">
                {entry.content}
              </p>
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-border-soft pt-4">
                <time className="text-xs text-faint">
                  {new Date(entry.created_at).toLocaleString()}
                </time>
                <div className="flex flex-wrap gap-2">
                  <ActionPill onClick={() => startEdit(entry)}>
                    <PencilIcon />
                    Edit
                  </ActionPill>
                  <ActionPill
                    onClick={() => deleteEntry(entry)}
                    disabled={deletingId === entry.id}
                  >
                    <TrashIcon />
                    {deletingId === entry.id ? "Deleting…" : "Delete"}
                  </ActionPill>
                  <ActionPill
                    onClick={() => reflect(entry)}
                    disabled={reflectingId === entry.id}
                    variant="accent"
                  >
                    <SparkleIcon />
                    {reflectingId === entry.id ? "Reflecting…" : "Reflect on this"}
                  </ActionPill>
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

function ActionPill({
  onClick,
  disabled,
  variant = "default",
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  variant?: "default" | "accent";
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={
        variant === "accent"
          ? "inline-flex items-center gap-1.5 rounded-full border border-accent/40 bg-accent/10 px-3.5 py-1.5 text-xs font-semibold text-accent-strong transition hover:bg-accent/15 disabled:opacity-50"
          : "inline-flex items-center gap-1.5 rounded-full border border-border px-3.5 py-1.5 text-xs font-semibold text-muted transition hover:bg-foreground/5 disabled:opacity-50"
      }
    >
      {children}
    </button>
  );
}

function PencilIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 6h18" />
      <path d="M8 6V4h8v2" />
      <path d="M19 6l-1 14H6L5 6" />
    </svg>
  );
}

function SparkleIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3v3M12 18v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M3 12h3M18 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1" />
    </svg>
  );
}

function ChevronIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

/**
 * Renders the reflection under the entry it was generated for, plus the past
 * entries used to ground it — so the RAG is visibly working.
 */
function ReflectionPanel({ data }: { data: ReflectResponse }) {
  return (
    <div className="mt-5 rounded-sm border border-accent/25 bg-gradient-to-br from-accent/[0.09] to-accent/[0.03] p-5">
      <p className="whitespace-pre-wrap font-serif text-base italic leading-relaxed text-foreground">
        {data.reflection}
      </p>
      {data.grounding.length > 0 && (
        <details className="mt-4 border-t border-accent/15 pt-4 text-xs text-faint">
          <summary className="flex cursor-pointer list-none items-center gap-2 font-semibold [&::-webkit-details-marker]:hidden">
            <ChevronIcon />
            Grounded in {data.grounding.length} past{" "}
            {data.grounding.length === 1 ? "entry" : "entries"}
          </summary>
          <ul className="mt-3 space-y-2">
            {data.grounding.map((g) => (
              <li key={g.id} className="flex gap-2">
                <span className="shrink-0">
                  {new Date(g.created_at).toLocaleDateString()}
                </span>
                <span>
                  {g.content.slice(0, 80)}
                  {g.content.length > 80 ? "…" : ""}
                </span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
