"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface TourStep {
  selector: string;
  title: string;
  body: string;
}

const STEPS: TourStep[] = [
  {
    selector: '[data-tour="compose"]',
    title: "Write freely",
    body: "Start here. Jot down whatever's on your mind — nothing is scored, shared, or judged.",
  },
  {
    selector: '[data-tour="reflect"]',
    title: "Ask for a reflection",
    body: "This is the heart of Journal Buddy: it retrieves your relevant past entries and grounds its reflection in your own history. It's deliberately never automatic — only when you ask.",
  },
  {
    selector: '[data-tour="about-link"]',
    title: "Curious how it works?",
    body: "The About page walks through the RAG pipeline and the crisis-safety design behind the app.",
  },
];

const STORAGE_KEY = "journal-buddy:tour-seen";
const TITLE_ID = "app-tour-title";

export function hasSeenTour(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

function markTourSeen() {
  try {
    localStorage.setItem(STORAGE_KEY, "1");
  } catch {
    // Private browsing / blocked storage — fine, just won't persist.
  }
}

export default function AppTour({ onClose }: { onClose: () => void }) {
  const [stepIndex, setStepIndex] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  const close = useCallback(() => {
    markTourSeen();
    onClose();
    previouslyFocused.current?.focus?.();
  }, [onClose]);

  const goTo = useCallback(
    (start: number, direction: 1 | -1) => {
      let i = start;
      while (i >= 0 && i < STEPS.length) {
        const el = document.querySelector(STEPS[i].selector);
        if (el) {
          setStepIndex(i);
          el.scrollIntoView({ block: "center" });
          requestAnimationFrame(() => setRect(el.getBoundingClientRect()));
          return;
        }
        i += direction;
      }
      close();
    },
    [close]
  );

  useEffect(() => {
    previouslyFocused.current = document.activeElement as HTMLElement | null;
    const frame = requestAnimationFrame(() => goTo(0, 1));
    return () => cancelAnimationFrame(frame);
    // Only run once on mount — goTo is stable enough for this purpose.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Move focus into the dialog each time it appears/advances to a new step.
  useEffect(() => {
    if (rect) dialogRef.current?.focus();
  }, [rect, stepIndex]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        close();
        return;
      }
      if (e.key !== "Tab" || !dialogRef.current) return;

      const focusable = dialogRef.current.querySelectorAll<HTMLElement>("button");
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;

      if (active === dialogRef.current) {
        // Focus is on the dialog wrapper itself (just opened) — send it to an edge button.
        e.preventDefault();
        (e.shiftKey ? last : first).focus();
      } else if (e.shiftKey && active === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      } else if (!dialogRef.current.contains(active)) {
        // Focus escaped the dialog (e.g. auto-focus landed elsewhere) — pull it back in.
        e.preventDefault();
        first.focus();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [close]);

  if (!rect) return null;

  const pad = 8;
  const step = STEPS[stepIndex];
  const tooltipWidth = 320;
  const tooltipTop = Math.min(rect.bottom + pad + 12, window.innerHeight - 200);
  const tooltipLeft = Math.min(
    Math.max(rect.left, 16),
    window.innerWidth - tooltipWidth - 16
  );

  return (
    <div className="fixed inset-0 z-[60]">
      <div
        aria-hidden
        style={{
          position: "fixed",
          top: rect.top - pad,
          left: rect.left - pad,
          width: rect.width + pad * 2,
          height: rect.height + pad * 2,
          borderRadius: 10,
          boxShadow: "0 0 0 9999px rgba(10, 7, 5, 0.78)",
          pointerEvents: "none",
          transition: "top 0.25s ease, left 0.25s ease, width 0.25s ease, height 0.25s ease",
        }}
      />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={TITLE_ID}
        tabIndex={-1}
        className="fixed rounded-sm border border-accent/40 bg-gradient-to-br from-surface to-surface-2 p-5 shadow-[0_24px_50px_rgba(0,0,0,0.45)] outline-none"
        style={{ top: tooltipTop, left: tooltipLeft, width: tooltipWidth }}
      >
        <div key={stepIndex} className="animate-[fade-rise_0.3s_ease-out_both]">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-accent">
            Step {stepIndex + 1} of {STEPS.length}
          </p>
          <h3
            id={TITLE_ID}
            className="mt-2 font-serif text-lg italic text-foreground"
          >
            {step.title}
          </h3>
          <p className="mt-2 text-sm leading-relaxed text-muted">{step.body}</p>
        </div>
        <div className="mt-4 flex items-center justify-between">
          <button
            onClick={close}
            className="text-xs text-faint underline underline-offset-4"
          >
            Skip tour
          </button>
          <div className="flex gap-2">
            {stepIndex > 0 && (
              <button
                onClick={() => goTo(stepIndex - 1, -1)}
                className="rounded-full border border-border px-3.5 py-1.5 text-xs font-semibold text-muted transition hover:bg-foreground/5"
              >
                Back
              </button>
            )}
            <button
              onClick={() =>
                stepIndex + 1 < STEPS.length ? goTo(stepIndex + 1, 1) : close()
              }
              className="rounded-full bg-accent px-3.5 py-1.5 text-xs font-bold text-accent-ink transition hover:opacity-90"
            >
              {stepIndex + 1 < STEPS.length ? "Next" : "Done"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
