import { Fragment } from "react";
import { computeThemeTrends } from "@/lib/theme-trends";
import type { Entry } from "@/lib/types";
import { ChevronIcon } from "@/components/icons";

/**
 * Sequential amber ramp for cell magnitude (count of entries mentioning a
 * theme in a given week). One hue, light->dark in OKLCH terms but "flipped"
 * for this dark surface: dim/near-surface = low, bright accent = high —
 * validated with the dataviz skill's ordinal-ramp checks (monotone lightness,
 * >=0.06 adjacent steps, light-end contrast >=2:1 against #1c1512).
 */
const RAMP = ["#5c4530", "#82623d", "#a87e46", "#c9974d", "#ecc07a"];

function cellColor(count: number): string | undefined {
  if (count === 0) return undefined;
  return RAMP[Math.min(count, RAMP.length) - 1];
}

export default function ThemeTrends({ entries }: { entries: Entry[] }) {
  const trends = computeThemeTrends(entries);

  if (!trends) {
    return (
      <section className="relative overflow-hidden rounded-sm border border-border-soft bg-gradient-to-br from-surface to-surface-2 p-6">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full"
          style={{
            background:
              "radial-gradient(circle, rgba(217,162,76,0.14) 0%, transparent 70%)",
          }}
        />
        <div className="text-xs font-bold uppercase tracking-[0.2em] text-accent">
          Recurring themes
        </div>
        <p className="relative mt-2 max-w-sm text-sm leading-relaxed text-faint">
          Write a few entries and Journal Buddy will start noticing what&apos;s
          been on your mind — recurring themes will show up here, mapped
          across the weeks.
        </p>
      </section>
    );
  }

  const { weeks, rows } = trends;

  return (
    <section className="rounded-sm border border-border-soft bg-gradient-to-br from-surface to-surface-2 p-6">
      <div className="flex items-baseline justify-between gap-4">
        <div>
          <div className="text-xs font-bold uppercase tracking-[0.2em] text-accent">
            Recurring themes
          </div>
          <h2 className="mt-1 font-serif text-xl italic text-foreground">
            What&apos;s been on your mind
          </h2>
        </div>
        <div className="hidden shrink-0 items-center gap-1.5 text-[11px] text-faint sm:flex">
          Less
          <span className="flex gap-0.5">
            {RAMP.map((hex) => (
              <span
                key={hex}
                className="h-2.5 w-2.5 rounded-[2px]"
                style={{ backgroundColor: hex }}
              />
            ))}
          </span>
          More
        </div>
      </div>

      <div className="mt-5 overflow-x-auto">
        <div
          className="grid w-fit gap-x-0.5 gap-y-1"
          style={{
            gridTemplateColumns: `minmax(90px, auto) repeat(${weeks.length}, 18px)`,
          }}
        >
          <div />
          {weeks.map((week, i) => (
            <div key={i} className="relative h-6">
              {i % 2 === 0 && (
                <span className="absolute right-0 top-0 origin-top-right -rotate-45 whitespace-nowrap text-[9px] text-faint">
                  {week.label}
                </span>
              )}
            </div>
          ))}

          {rows.map((row) => (
            <Fragment key={row.theme}>
              <div
                className="flex items-center truncate pr-2 text-xs text-muted"
                title={row.theme}
              >
                {row.theme}
              </div>
              {row.counts.map((count, i) => {
                const color = cellColor(count);
                const weekLabel = weeks[i].label;
                return (
                  <div key={`${row.theme}-${i}`} className="group relative">
                    <button
                      type="button"
                      className="h-[18px] w-[18px] rounded-[3px] border border-border-soft transition group-hover:scale-110 group-focus-within:scale-110"
                      style={{ backgroundColor: color ?? "transparent" }}
                      aria-label={`${row.theme}: ${count} ${count === 1 ? "entry" : "entries"} the week of ${weekLabel}`}
                    />
                    <div
                      role="tooltip"
                      className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1.5 w-max -translate-x-1/2 rounded-sm border border-border-soft bg-surface-2 px-2 py-1 text-[11px] text-foreground opacity-0 shadow-[0_8px_20px_rgba(0,0,0,0.4)] transition group-hover:opacity-100 group-focus-within:opacity-100"
                    >
                      <span className="font-semibold">{count}</span>{" "}
                      {count === 1 ? "entry" : "entries"} · {row.theme} · week of{" "}
                      {weekLabel}
                    </div>
                  </div>
                );
              })}
            </Fragment>
          ))}
        </div>
      </div>

      <details className="mt-5 border-t border-border-soft pt-3 text-xs text-faint">
        <summary className="flex cursor-pointer list-none items-center gap-2 font-semibold [&::-webkit-details-marker]:hidden">
          <ChevronIcon />
          View as list
        </summary>
        <ul className="mt-3 space-y-1.5">
          {rows.map((row) => (
            <li key={row.theme} className="flex items-center justify-between gap-4">
              <span className="text-muted">{row.theme}</span>
              <span>
                {row.total} {row.total === 1 ? "entry" : "entries"}
              </span>
            </li>
          ))}
        </ul>
      </details>
    </section>
  );
}
