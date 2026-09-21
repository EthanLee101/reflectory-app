"use client";

import { useState } from "react";
import type { Entry, ReflectResponse } from "@/lib/types";
import { MAX_ENTRY_LENGTH } from "@/lib/constants";
import ActionPill from "@/components/ActionPill";
import ReflectionPanel from "@/components/ReflectionPanel";
import ReflectionHistory from "@/components/ReflectionHistory";
import { PencilIcon, TrashIcon, SparkleIcon } from "@/components/icons";

export default function EntryCard({
  entry,
  isFirst,
  index,
  deleting,
  reflecting,
  reflection,
  onSaveEdit,
  onDelete,
  onReflect,
}: {
  entry: Entry;
  /** Marks the "Reflect on this" pill on the most recent entry for the app tour. */
  isFirst: boolean;
  /** Position in the visible list; staggers this card's entrance animation. */
  index: number;
  deleting: boolean;
  reflecting: boolean;
  reflection: ReflectResponse | null;
  onSaveEdit: (entry: Entry, content: string) => Promise<boolean>;
  onDelete: (entry: Entry) => Promise<void>;
  onReflect: (entry: Entry) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [editDraft, setEditDraft] = useState(entry.content);
  const [savingEdit, setSavingEdit] = useState(false);

  function startEdit() {
    setEditDraft(entry.content);
    setEditing(true);
  }

  async function saveEdit() {
    if (!editDraft.trim()) return;
    setSavingEdit(true);
    const ok = await onSaveEdit(entry, editDraft);
    setSavingEdit(false);
    if (ok) setEditing(false);
  }

  if (editing) {
    return (
      <article className="rounded-sm border border-border-soft bg-surface p-6">
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
            <ActionPill onClick={() => setEditing(false)} disabled={savingEdit}>
              Cancel
            </ActionPill>
            <button
              onClick={saveEdit}
              disabled={savingEdit || !editDraft.trim()}
              className="rounded-full bg-accent px-3.5 py-1.5 text-xs font-bold text-accent-ink transition hover:opacity-90 disabled:opacity-50"
            >
              {savingEdit ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
      </article>
    );
  }

  return (
    <article
      className="animate-[fade-rise_0.5s_ease-out_both] rounded-sm border border-border-soft bg-surface p-6 lg:p-7"
      style={{ animationDelay: `${Math.min(index, 6) * 60}ms` }}
    >
      <p className="whitespace-pre-wrap font-serif text-base leading-relaxed text-foreground">
        {entry.content}
      </p>

      {entry.themes.length > 0 && (
        <ul className="mt-4 flex flex-wrap gap-1.5">
          {entry.themes.map((theme) => (
            <li
              key={theme}
              className="rounded-full border border-border-soft bg-surface-2 px-2.5 py-0.5 text-xs text-faint"
            >
              {theme}
            </li>
          ))}
        </ul>
      )}

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-border-soft pt-4">
        <time className="text-xs text-faint">
          {new Date(entry.created_at).toLocaleString()}
        </time>
        <div className="flex flex-wrap gap-2">
          <ActionPill onClick={startEdit}>
            <PencilIcon />
            Edit
          </ActionPill>
          <ActionPill onClick={() => onDelete(entry)} disabled={deleting}>
            <TrashIcon />
            {deleting ? "Deleting…" : "Delete"}
          </ActionPill>
          <ActionPill
            data-tour={isFirst ? "reflect" : undefined}
            onClick={() => onReflect(entry)}
            disabled={reflecting}
            variant="accent"
          >
            <SparkleIcon />
            {reflecting ? "Reflecting…" : "Reflect on this"}
          </ActionPill>
        </div>
      </div>

      {reflection && <ReflectionPanel data={reflection} />}

      <ReflectionHistory entryId={entry.id} />
    </article>
  );
}
