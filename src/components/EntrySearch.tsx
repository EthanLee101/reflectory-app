"use client";

import { useState } from "react";
import { MAX_SEARCH_QUERY_LENGTH } from "@/lib/constants";

export default function EntrySearch({
  onSearch,
  onClear,
  searching,
  activeQuery,
  resultCount,
}: {
  onSearch: (query: string) => void;
  onClear: () => void;
  searching: boolean;
  activeQuery: string | null;
  resultCount: number | null;
}) {
  const [draft, setDraft] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!draft.trim()) return;
    onSearch(draft.trim());
  }

  function handleClear() {
    setDraft("");
    onClear();
  }

  return (
    <div>
      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          type="search"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          maxLength={MAX_SEARCH_QUERY_LENGTH}
          placeholder="Recall — search your past entries…"
          className="w-full rounded-full border border-border-soft bg-surface px-4 py-2 text-sm text-foreground outline-none placeholder:text-faint focus:border-accent"
        />
        <button
          type="submit"
          disabled={searching || !draft.trim()}
          className="shrink-0 rounded-full border border-border px-4 py-2 text-sm font-semibold text-muted transition hover:bg-foreground/5 disabled:opacity-50"
        >
          {searching ? "Searching…" : "Search"}
        </button>
      </form>

      {activeQuery !== null && (
        <div className="mt-3 flex animate-[fade-rise_0.3s_ease-out_both] items-center justify-between text-xs text-faint">
          <span>
            {resultCount ?? 0} {resultCount === 1 ? "match" : "matches"} for
            &ldquo;{activeQuery}&rdquo;
          </span>
          <button
            onClick={handleClear}
            className="text-muted underline underline-offset-4 transition hover:text-foreground"
          >
            Clear
          </button>
        </div>
      )}
    </div>
  );
}
