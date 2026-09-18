import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { computeThemeTrends } from "@/lib/theme-trends";
import type { Entry } from "@/lib/types";

function makeEntry(overrides: Partial<Entry>): Entry {
  return {
    id: "e",
    user_id: "u",
    content: "content",
    themes: [],
    created_at: "2026-09-14T10:00:00.000Z",
    ...overrides,
  };
}

beforeEach(() => {
  // A fixed Monday, so week bucketing is deterministic.
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-09-14T12:00:00"));
});

afterEach(() => {
  vi.useRealTimers();
});

describe("computeThemeTrends", () => {
  it("returns null when no entry has any theme tags", () => {
    const entries = [makeEntry({ themes: [] }), makeEntry({ themes: [] })];
    expect(computeThemeTrends(entries)).toBeNull();
  });

  it("returns null when every themed entry falls outside the window", () => {
    const entries = [
      makeEntry({ themes: ["old theme"], created_at: "2026-08-20T10:00:00" }),
    ];
    expect(computeThemeTrends(entries, { maxWeeks: 3 })).toBeNull();
  });

  it("buckets entries into weeks and aggregates counts per theme", () => {
    const entries = [
      makeEntry({ themes: ["work stress", "focus"], created_at: "2026-09-14T10:00:00" }),
      makeEntry({ themes: ["work stress"], created_at: "2026-09-08T10:00:00" }),
      makeEntry({ themes: ["old theme"], created_at: "2026-08-20T10:00:00" }),
    ];

    const result = computeThemeTrends(entries, { maxWeeks: 3 });
    expect(result).not.toBeNull();
    expect(result!.weeks).toHaveLength(3);
    expect(result!.weeks[2].start.toISOString().slice(0, 10)).toBe("2026-09-14");

    const workStress = result!.rows.find((r) => r.theme === "work stress");
    expect(workStress?.total).toBe(2);
    expect(workStress?.counts).toEqual([0, 1, 1]);

    const focus = result!.rows.find((r) => r.theme === "focus");
    expect(focus?.total).toBe(1);
    expect(focus?.counts).toEqual([0, 0, 1]);

    expect(result!.rows.find((r) => r.theme === "old theme")).toBeUndefined();
  });

  it("sorts rows by total descending and caps at maxThemes", () => {
    const entries = [
      makeEntry({ themes: ["a"] }),
      makeEntry({ themes: ["b", "a"] }),
      makeEntry({ themes: ["b"] }),
      makeEntry({ themes: ["b"] }),
      makeEntry({ themes: ["c"] }),
    ];

    const result = computeThemeTrends(entries, { maxThemes: 2 });
    expect(result!.rows).toHaveLength(2);
    expect(result!.rows.map((r) => r.theme)).toEqual(["b", "a"]);
  });
});
