"use client";

import { useEffect, useState } from "react";
import type { Entry, ReflectResponse } from "@/lib/types";
import CrisisBanner from "@/components/CrisisBanner";
import EntryComposer from "@/components/EntryComposer";
import EntryCard from "@/components/EntryCard";
import AppTour, { hasSeenTour } from "@/components/AppTour";

export default function JournalClient({
  initialEntries,
}: {
  initialEntries: Entry[];
}) {
  const [entries, setEntries] = useState<Entry[]>(initialEntries);
  const [crisis, setCrisis] = useState(false);

  // Reflection state, keyed by the entry being reflected on.
  const [reflectingId, setReflectingId] = useState<string | null>(null);
  const [reflection, setReflection] = useState<ReflectResponse | null>(null);
  // Which entry the current reflection belongs to.
  const [reflectedFor, setReflectedFor] = useState<string | null>(null);

  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [tourOpen, setTourOpen] = useState(false);

  useEffect(() => {
    if (hasSeenTour()) return;
    const t = setTimeout(() => setTourOpen(true), 700);
    return () => clearTimeout(t);
  }, []);

  async function saveEntry(content: string) {
    setCrisis(false);

    const res = await fetch("/api/entries", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content }),
    });

    if (!res.ok) return false;

    const { entry, crisis: crisisResult } = await res.json();
    setEntries((prev) => [entry as Entry, ...prev]);
    if (crisisResult?.triggered) setCrisis(true);
    return true;
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

  async function saveEdit(entry: Entry, content: string) {
    const res = await fetch(`/api/entries/${entry.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content }),
    });

    if (!res.ok) return;

    const { entry: updated, crisis: crisisResult } = await res.json();
    setEntries((prev) =>
      prev.map((e) => (e.id === entry.id ? (updated as Entry) : e))
    );
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

    setEntries((prev) => prev.filter((e) => e.id !== entry.id));
    if (reflectedFor === entry.id) {
      setReflection(null);
      setReflectedFor(null);
    }
  }

  return (
    <div className="space-y-8">
      {crisis && <CrisisBanner />}

      <div className="lg:grid lg:grid-cols-[320px_1px_1fr] lg:items-start lg:gap-10">
        <div className="space-y-5 lg:sticky lg:top-10">
          <EntryComposer onSave={saveEntry} />
          <button
            onClick={() => setTourOpen(true)}
            className="inline-flex items-center gap-1.5 pl-1 text-xs font-semibold text-faint underline underline-offset-4 transition hover:text-muted"
          >
            Take the tour
          </button>
        </div>

        <div aria-hidden className="hidden h-full w-px bg-border-soft lg:block" />

        <section className="mt-10 space-y-5 lg:mt-0">
          {entries.length === 0 && (
            <p className="text-faint">
              No entries yet. Your first one is on the left.
            </p>
          )}

          {entries.map((entry, i) => (
            <EntryCard
              key={entry.id}
              entry={entry}
              isFirst={i === 0}
              deleting={deletingId === entry.id}
              reflecting={reflectingId === entry.id}
              reflection={reflectedFor === entry.id ? reflection : null}
              onSaveEdit={saveEdit}
              onDelete={deleteEntry}
              onReflect={reflect}
            />
          ))}
        </section>
      </div>

      {tourOpen && <AppTour onClose={() => setTourOpen(false)} />}
    </div>
  );
}
