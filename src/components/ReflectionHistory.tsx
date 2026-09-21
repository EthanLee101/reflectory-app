"use client";

import { useState } from "react";
import type { Reflection } from "@/lib/types";
import ReflectionPanel from "@/components/ReflectionPanel";
import { ChevronIcon } from "@/components/icons";
import { useToast } from "@/components/Toast";

/** Lazily-loaded list of an entry's past reflections, fetched on first expand. */
export default function ReflectionHistory({ entryId }: { entryId: string }) {
  const { showError } = useToast();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [reflections, setReflections] = useState<Reflection[] | null>(null);

  async function load() {
    setLoading(true);
    setError(false);
    try {
      const res = await fetch(`/api/entries/${entryId}/reflections`);
      if (!res.ok) {
        setError(true);
        showError("Couldn't load past reflections.");
        return;
      }
      const { reflections: data } = await res.json();
      setReflections(data as Reflection[]);
    } catch {
      setError(true);
      showError("Couldn't load past reflections — check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  async function toggle() {
    if (open) {
      setOpen(false);
      return;
    }
    setOpen(true);
    if (reflections !== null) return;
    await load();
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
          {!loading && error && (
            <p className="text-xs text-faint">
              Couldn&apos;t load past reflections.{" "}
              <button onClick={load} className="underline underline-offset-2">
                Retry
              </button>
            </p>
          )}
          {!loading && !error && reflections?.length === 0 && (
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
