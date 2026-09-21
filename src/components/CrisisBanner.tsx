import { CRISIS_RESOURCES } from "@/lib/crisis-resources";

/**
 * Shown when crisis detection triggers. This does not counsel the user — it
 * hands off to real, current crisis resources.
 */
export default function CrisisBanner() {
  return (
    <div
      role="alert"
      className="animate-[fade-rise_0.4s_ease-out_both,glow-pulse_2.6s_ease-in-out_2] border-l-[5px] border-danger-strong bg-danger-bg p-6"
    >
      <div className="flex items-start gap-3.5">
        <svg
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          stroke="var(--danger-strong)"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="mt-0.5 shrink-0"
        >
          <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
          <path d="M12 9v4" />
          <path d="M12 17h.01" />
        </svg>
        <div>
          <p className="font-semibold text-danger-text">
            It sounds like you may be going through something really hard.
          </p>
          <p className="mt-1.5 text-sm text-danger-text/85">
            Reflectory isn&apos;t a crisis service, but people who are
            ready to help are available right now:
          </p>
        </div>
      </div>
      <ul className="mt-4 space-y-2 pl-[38px]">
        {CRISIS_RESOURCES.map((r) => (
          <li key={r.name} className="text-sm text-danger-text">
            <span className="font-semibold">{r.name}</span> — {r.description}{" "}
            {r.href ? (
              <a
                href={r.href}
                target="_blank"
                rel="noopener noreferrer"
                className="underline underline-offset-2"
              >
                {r.contact}
              </a>
            ) : (
              <span>{r.contact}</span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
