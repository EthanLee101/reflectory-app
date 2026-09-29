/**
 * Live crisis-detection eval: runs the real detectCrisis (keyword layer + Gemini
 * classifier) against the labeled cases and prints recall/precision.
 *
 *   npm run eval:crisis        (needs GEMINI_API_KEY in .env.local)
 *
 * Not part of `npm test` / CI: it spends API quota and LLM output can vary run
 * to run. Report the numbers with the date and model you ran them against.
 */
import { describe, it, expect, vi } from "vitest";
import { detectCrisis } from "@/lib/crisis";
import {
  BENIGN,
  EXPLICIT_POSITIVES,
  INDIRECT_POSITIVES,
  KEYWORD_FALSE_POSITIVE_RISKS,
} from "@/lib/crisis-eval-cases";

type Row = { group: string; text: string; expected: boolean; triggered: boolean; source: string };

async function run(group: string, texts: string[], expected: boolean): Promise<Row[]> {
  const rows: Row[] = [];
  for (const text of texts) {
    const r = await detectCrisis(text);
    rows.push({ group, text: text.slice(0, 60), expected, triggered: r.triggered, source: r.source });
  }
  return rows;
}

const pct = (n: number, d: number) => (d === 0 ? "n/a" : `${((100 * n) / d).toFixed(0)}% (${n}/${d})`);

describe("crisis detection eval (live)", () => {
  it("reports recall and precision", async () => {
    expect(process.env.GEMINI_API_KEY, "GEMINI_API_KEY must be set").toBeTruthy();

    // detectCrisis fails open on a classifier error (by design) and logs it. An
    // errored classifier would read as "0% recall", so count those logs and
    // refuse to report numbers if any occurred (e.g. a free-tier quota 429).
    const errorLogs: string[] = [];
    const errSpy = vi.spyOn(console, "error").mockImplementation((line: unknown) => {
      if (typeof line === "string" && line.includes('"route":"detectCrisis"')) errorLogs.push(line);
    });

    const rows = [
      ...(await run("explicit+", EXPLICIT_POSITIVES, true)),
      ...(await run("indirect+", INDIRECT_POSITIVES, true)),
      ...(await run("benign", BENIGN, false)),
      ...(await run("keyword-fp-risk", KEYWORD_FALSE_POSITIVE_RISKS, false)),
    ];

    errSpy.mockRestore();
    expect(
      errorLogs,
      `Classifier errored on ${errorLogs.length} call(s); results are invalid. First error: ${errorLogs[0]?.slice(0, 300)}`
    ).toHaveLength(0);

    const positives = rows.filter((r) => r.expected);
    const negatives = rows.filter((r) => !r.expected);
    const tp = positives.filter((r) => r.triggered).length;
    const fp = negatives.filter((r) => r.triggered).length;
    const byGroup = (g: string) => rows.filter((r) => r.group === g);

    console.table(rows.filter((r) => r.triggered !== r.expected));
    console.log(
      [
        `model: ${process.env.GEMINI_CHAT_MODEL ?? "gemini-flash-latest"}   date: ${new Date().toISOString().slice(0, 10)}`,
        `overall recall:           ${pct(tp, positives.length)}`,
        `overall precision:        ${pct(tp, tp + fp)}`,
        `explicit recall:          ${pct(byGroup("explicit+").filter((r) => r.triggered).length, EXPLICIT_POSITIVES.length)}`,
        `indirect recall (LLM):    ${pct(byGroup("indirect+").filter((r) => r.triggered).length, INDIRECT_POSITIVES.length)}`,
        `benign false positives:   ${pct(byGroup("benign").filter((r) => r.triggered).length, BENIGN.length)}`,
        `keyword-fp-risk flagged:  ${pct(byGroup("keyword-fp-risk").filter((r) => r.triggered).length, KEYWORD_FALSE_POSITIVE_RISKS.length)}`,
        "(rows above listed only where the result differed from the label)",
      ].join("\n")
    );
  }, 120_000);
});
