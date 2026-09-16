import type { ReflectResponse } from "@/lib/types";
import { ChevronIcon } from "@/components/icons";

/**
 * Renders the reflection under the entry it was generated for, plus the past
 * entries used to ground it — so the RAG is visibly working.
 */
export default function ReflectionPanel({ data }: { data: ReflectResponse }) {
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
