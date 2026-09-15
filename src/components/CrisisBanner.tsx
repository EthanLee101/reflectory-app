import { CRISIS_RESOURCES } from "@/lib/crisis-resources";

/**
 * Shown when crisis detection triggers. This does not counsel the user — it
 * hands off to real, current crisis resources.
 */
export default function CrisisBanner() {
  return (
    <div
      role="alert"
      className="rounded-xl border border-rose-200 bg-rose-50 p-5 text-rose-900"
    >
      <p className="font-medium">
        It sounds like you may be going through something really hard.
      </p>
      <p className="mt-1 text-sm text-rose-800">
        Journal Buddy isn&apos;t a crisis service, but people who are ready to
        help are available right now:
      </p>
      <ul className="mt-3 space-y-2">
        {CRISIS_RESOURCES.map((r) => (
          <li key={r.name} className="text-sm">
            <span className="font-medium">{r.name}</span> — {r.description}{" "}
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
