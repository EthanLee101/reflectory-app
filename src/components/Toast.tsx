"use client";

import { createContext, useCallback, useContext, useRef, useState } from "react";

type Toast = { id: number; message: string };

const ToastContext = createContext<{ showError: (message: string) => void } | null>(
  null
);

const AUTO_DISMISS_MS = 5000;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(0);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showError = useCallback(
    (message: string) => {
      const id = nextId.current++;
      setToasts((prev) => [...prev, { id, message }]);
      setTimeout(() => dismiss(id), AUTO_DISMISS_MS);
    },
    [dismiss]
  );

  return (
    <ToastContext.Provider value={{ showError }}>
      {children}
      <div className="pointer-events-none fixed bottom-4 right-4 z-50 flex w-full max-w-sm flex-col gap-2 sm:right-6">
        {toasts.map((t) => (
          <div
            key={t.id}
            role="alert"
            className="animate-[fade-rise_0.3s_ease-out_both] pointer-events-auto flex items-start justify-between gap-3 rounded-sm border-l-[5px] border-danger-strong bg-danger-bg px-4 py-3 text-sm text-danger-text shadow-[0_20px_40px_rgba(0,0,0,0.4)]"
          >
            <span>{t.message}</span>
            <button
              onClick={() => dismiss(t.id)}
              aria-label="Dismiss"
              className="shrink-0 text-danger-text/70 transition hover:text-danger-text"
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within a ToastProvider");
  return ctx;
}
