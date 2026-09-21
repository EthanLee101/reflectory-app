"use client";

import { useEffect, useState } from "react";
import type { Entry, ReflectResponse } from "@/lib/types";
import CrisisBanner from "@/components/CrisisBanner";
import EntryComposer from "@/components/EntryComposer";
import EntryCard from "@/components/EntryCard";
import EntrySearch from "@/components/EntrySearch";
import ThemeTrends from "@/components/ThemeTrends";
import AppTour, { hasSeenTour } from "@/components/AppTour";
import { ToastProvider, useToast } from "@/components/Toast";

const GENERIC_ERROR = "Something went wrong. Please try again.";

async function errorMessageFrom(res: Response): Promise<string> {
  try {
    const body = await res.json();
    return typeof body?.error === "string" ? body.error : GENERIC_ERROR;
  } catch {
    return GENERIC_ERROR;
  }
}

export default function JournalClient(props: {
  initialEntries: Entry[];
  initialNextCursor: string | null;
  initialEntriesError?: string | null;
}) {
  return (
    <ToastProvider>
      <JournalClientInner {...props} />
    </ToastProvider>
  );
}

function JournalClientInner({
  initialEntries,
  initialNextCursor,
  initialEntriesError = null,
}: {
  initialEntries: Entry[];
  initialNextCursor: string | null;
  initialEntriesError?: string | null;
}) {
  const { showError } = useToast();

  const [entries, setEntries] = useState<Entry[]>(initialEntries);
  const [entriesError] = useState<string | null>(initialEntriesError);
  const [nextCursor, setNextCursor] = useState<string | null>(initialNextCursor);
  const [loadingMore, setLoadingMore] = useState(false);
  const [crisis, setCrisis] = useState(false);

  // Reflection state, keyed by the entry being reflected on.
  const [reflectingId, setReflectingId] = useState<string | null>(null);
  const [reflection, setReflection] = useState<ReflectResponse | null>(null);
  // Which entry the current reflection belongs to.
  const [reflectedFor, setReflectedFor] = useState<string | null>(null);

  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [tourOpen, setTourOpen] = useState(false);

  const [activeQuery, setActiveQuery] = useState<string | null>(null);
  const [searchResults, setSearchResults] = useState<Entry[] | null>(null);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    if (hasSeenTour() || entries.length === 0) return;
    const t = setTimeout(() => setTourOpen(true), 700);
    return () => clearTimeout(t);
  }, [entries.length]);

  async function saveEntry(content: string) {
    setCrisis(false);

    try {
      const res = await fetch("/api/entries", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": crypto.randomUUID(),
        },
        body: JSON.stringify({ content }),
      });

      if (!res.ok) {
        showError(await errorMessageFrom(res));
        return false;
      }

      const { entry, crisis: crisisResult } = await res.json();
      setEntries((prev) => [entry as Entry, ...prev]);
      if (crisisResult?.triggered) setCrisis(true);
      return true;
    } catch {
      showError("Couldn't save your entry — check your connection and try again.");
      return false;
    }
  }

  async function reflect(entry: Entry) {
    setReflectingId(entry.id);
    setReflection(null);
    setReflectedFor(null);
    setCrisis(false);

    try {
      const res = await fetch("/api/reflect", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": crypto.randomUUID(),
        },
        body: JSON.stringify({ entryId: entry.id, content: entry.content }),
      });

      if (!res.ok) {
        showError(await errorMessageFrom(res));
        return;
      }

      const data = (await res.json()) as ReflectResponse;
      setReflection(data);
      setReflectedFor(entry.id);
      if (data.crisis?.triggered) setCrisis(true);
    } catch {
      showError("Couldn't generate a reflection — check your connection and try again.");
    } finally {
      setReflectingId(null);
    }
  }

  async function saveEdit(entry: Entry, content: string): Promise<boolean> {
    try {
      const res = await fetch(`/api/entries/${entry.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });

      if (!res.ok) {
        showError(await errorMessageFrom(res));
        return false;
      }

      const { entry: updated, crisis: crisisResult } = await res.json();
      const replace = (e: Entry) => (e.id === entry.id ? (updated as Entry) : e);
      setEntries((prev) => prev.map(replace));
      setSearchResults((prev) => (prev ? prev.map(replace) : prev));
      if (crisisResult?.triggered) setCrisis(true);
      if (reflectedFor === entry.id) {
        setReflection(null);
        setReflectedFor(null);
      }
      return true;
    } catch {
      showError("Couldn't save your edit — check your connection and try again.");
      return false;
    }
  }

  async function runSearch(query: string) {
    setSearching(true);
    try {
      const res = await fetch(`/api/entries/search?q=${encodeURIComponent(query)}`);
      if (!res.ok) {
        showError(await errorMessageFrom(res));
        return;
      }

      const { results } = (await res.json()) as {
        results: { id: string }[];
      };
      // Results come from a separate similarity-search call, not the entries
      // already loaded here — map back onto the loaded entries (in ranked
      // order) so the full EntryCard (edit/delete/reflect) still works.
      const byId = new Map(entries.map((e) => [e.id, e]));
      const matched = results
        .map((r) => byId.get(r.id))
        .filter((e): e is Entry => e !== undefined);

      setSearchResults(matched);
      setActiveQuery(query);
    } catch {
      showError("Search failed — check your connection and try again.");
    } finally {
      setSearching(false);
    }
  }

  function clearSearch() {
    setSearchResults(null);
    setActiveQuery(null);
  }

  const displayedEntries = activeQuery !== null ? searchResults ?? [] : entries;

  async function deleteEntry(entry: Entry) {
    if (!window.confirm("Delete this entry? This can't be undone.")) return;
    setDeletingId(entry.id);

    try {
      const res = await fetch(`/api/entries/${entry.id}`, { method: "DELETE" });
      if (!res.ok) {
        showError(await errorMessageFrom(res));
        return;
      }

      setEntries((prev) => prev.filter((e) => e.id !== entry.id));
      setSearchResults((prev) =>
        prev ? prev.filter((e) => e.id !== entry.id) : prev
      );
      if (reflectedFor === entry.id) {
        setReflection(null);
        setReflectedFor(null);
      }
    } catch {
      showError("Couldn't delete this entry — check your connection and try again.");
    } finally {
      setDeletingId(null);
    }
  }

  async function loadMore() {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const res = await fetch(`/api/entries?cursor=${encodeURIComponent(nextCursor)}`);
      if (!res.ok) {
        showError(await errorMessageFrom(res));
        return;
      }
      const { entries: page, nextCursor: newCursor } = (await res.json()) as {
        entries: Entry[];
        nextCursor: string | null;
      };
      setEntries((prev) => [...prev, ...page]);
      setNextCursor(newCursor);
    } catch {
      showError("Couldn't load more entries — check your connection and try again.");
    } finally {
      setLoadingMore(false);
    }
  }

  return (
    <div className="space-y-8">
      {crisis && <CrisisBanner />}

      <ThemeTrends entries={entries} />

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
          <EntrySearch
            onSearch={runSearch}
            onClear={clearSearch}
            searching={searching}
            activeQuery={activeQuery}
            resultCount={searchResults?.length ?? null}
          />

          {entriesError && (
            <p className="rounded-sm border-l-[5px] border-danger-strong bg-danger-bg px-4 py-3 text-sm text-danger-text">
              {entriesError}
            </p>
          )}

          {!entriesError && displayedEntries.length === 0 && (
            <p className="text-faint">
              {activeQuery !== null
                ? "No entries match that search."
                : "No entries yet. Your first one is on the left."}
            </p>
          )}

          {displayedEntries.map((entry, i) => (
            <EntryCard
              key={entry.id}
              entry={entry}
              isFirst={i === 0}
              index={i}
              deleting={deletingId === entry.id}
              reflecting={reflectingId === entry.id}
              reflection={reflectedFor === entry.id ? reflection : null}
              onSaveEdit={saveEdit}
              onDelete={deleteEntry}
              onReflect={reflect}
            />
          ))}

          {activeQuery === null && nextCursor && (
            <button
              onClick={loadMore}
              disabled={loadingMore}
              className="w-full rounded-sm border border-border-soft py-2.5 text-sm font-semibold text-muted transition hover:border-accent hover:text-foreground disabled:opacity-50"
            >
              {loadingMore ? "Loading…" : "Load more"}
            </button>
          )}
        </section>
      </div>

      {tourOpen && <AppTour onClose={() => setTourOpen(false)} />}
    </div>
  );
}
