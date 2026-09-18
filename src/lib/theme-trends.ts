import type { Entry } from "@/lib/types";

export interface ThemeTrendWeek {
  /** Monday of this week, at local midnight. */
  start: Date;
  label: string;
}

export interface ThemeTrendRow {
  theme: string;
  /** Entry count per week, aligned to `weeks`. */
  counts: number[];
  total: number;
}

export interface ThemeTrends {
  weeks: ThemeTrendWeek[];
  rows: ThemeTrendRow[];
}

const MS_PER_WEEK = 7 * 24 * 60 * 60 * 1000;

function startOfWeek(date: Date): Date {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = d.getDay();
  // Monday-aligned: Sunday (0) rolls back 6 days instead of 0.
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d;
}

function weekLabel(start: Date): string {
  return start.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

/**
 * Aggregates entry theme tags into a week x theme grid for the "recurring
 * themes" heatmap. Scoped to the most recent `maxWeeks` weeks and the
 * `maxThemes` most-frequent themes in that window — this is a recent-trends
 * view, not a full-history report. Returns null when there's nothing to show
 * (no entry in range has any theme tags yet).
 */
export function computeThemeTrends(
  entries: Entry[],
  { maxWeeks = 12, maxThemes = 8 }: { maxWeeks?: number; maxThemes?: number } = {}
): ThemeTrends | null {
  const tagged = entries.filter((e) => e.themes.length > 0);
  if (tagged.length === 0) return null;

  const now = new Date();
  const currentWeekStart = startOfWeek(now);
  const weeks: ThemeTrendWeek[] = Array.from({ length: maxWeeks }, (_, i) => {
    const start = new Date(currentWeekStart.getTime() - (maxWeeks - 1 - i) * MS_PER_WEEK);
    return { start, label: weekLabel(start) };
  });
  const windowStart = weeks[0].start;

  const totals = new Map<string, number>();
  const grid = new Map<string, number[]>();

  for (const entry of tagged) {
    const created = new Date(entry.created_at);
    if (created < windowStart) continue;
    const weekIndex = Math.min(
      maxWeeks - 1,
      Math.floor((startOfWeek(created).getTime() - windowStart.getTime()) / MS_PER_WEEK)
    );
    if (weekIndex < 0) continue;

    for (const theme of entry.themes) {
      totals.set(theme, (totals.get(theme) ?? 0) + 1);
      const counts = grid.get(theme) ?? new Array(maxWeeks).fill(0);
      counts[weekIndex] += 1;
      grid.set(theme, counts);
    }
  }

  if (totals.size === 0) return null;

  const rows: ThemeTrendRow[] = [...totals.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, maxThemes)
    .map(([theme, total]) => ({
      theme,
      total,
      counts: grid.get(theme) ?? new Array(maxWeeks).fill(0),
    }));

  return { weeks, rows };
}
