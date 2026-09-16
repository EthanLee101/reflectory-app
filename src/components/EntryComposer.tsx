"use client";

import { useState } from "react";
import { MAX_ENTRY_LENGTH } from "@/lib/constants";

export default function EntryComposer({
  onSave,
}: {
  /** Posts the draft; returns whether it saved, so the composer knows to clear. */
  onSave: (content: string) => Promise<boolean>;
}) {
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!draft.trim()) return;
    setSaving(true);
    const ok = await onSave(draft);
    setSaving(false);
    if (ok) setDraft("");
  }

  return (
    <form
      data-tour="compose"
      onSubmit={handleSubmit}
      className="rounded-sm border border-border-soft bg-gradient-to-br from-surface to-surface-2 p-6 shadow-[0_24px_50px_rgba(0,0,0,0.35)]"
    >
      <textarea
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        placeholder="What's on your mind today?"
        rows={6}
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
  );
}
