"use client";

import { useState } from "react";
import type { Reflection } from "@/lib/types";
import ReflectionPanel from "@/components/ReflectionPanel";
import { ChevronIcon } from "@/components/icons";

/** Lazily-loaded list of an entry's past reflections, fetched on first expand. */
export default function ReflectionHistory({ entryId }: { entryId: string }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [reflections, setReflections] = useState<Reflection[] | null>(null);

  async function toggle() {
    if (open) {
      setOpen(false);
      return;
    }
    setOpen(true);
    if (reflections !== null) return;

    setLoading(true);
    const res = await fetch(`/api/entries/${entryId}/reflections`);
    setLoading(false);
    if (!res.ok) return;

    const { reflections: data } = await res.json();
    setReflections(data as Reflection[]);
  }

  return (
    <div className="mt-4 border-t border-border-soft pt-4">
      <button
        onClick={toggle}
        className="flex items-center gap-2 text-xs font-semibold text-faint transition hover:text-muted"
      >
        <span className={`transition-transform ${open ? "rotate-180" : ""}`}>
          <ChevronIcon />
        </span>
        Past reflections
        {reflections !== null && ` (${reflections.length})`}
      </button>

      {open && (
        <div className="origin-top animate-[unfurl_0.35s_ease-out_both] mt-3 space-y-4">
          {loading && <p className="text-xs text-faint">Loading…</p>}
          {!loading && reflections?.length === 0 && (
            <p className="text-xs text-faint">
              No past reflections on this entry yet.
            </p>
          )}
          {reflections?.map((r) => (
            <div key={r.id}>
              <time className="text-xs text-faint">
                {new Date(r.created_at).toLocaleString()}
              </time>
              <ReflectionPanel
                data={{
                  reflection: r.content,
                  grounding: r.grounding,
                  crisis: r.crisis,
                }}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
