/**
 * Structured logging helper. Wraps console.error/console.warn with a
 * consistent JSON shape (level, route, message, context, timestamp) so
 * Vercel's log viewer — or a future Sentry/Logtail drain — has something
 * coherent to filter and parse, instead of ad-hoc free-text messages.
 */

type LogContext = Record<string, unknown>;

function emit(
  level: "error" | "warn",
  route: string,
  message: string,
  context?: LogContext
) {
  console[level](
    JSON.stringify({
      // Context spread first so it can never clobber the reserved fields
      // below (e.g. a caller passing a context key named "route" or
      // "message" must not silently overwrite the real ones).
      ...context,
      level,
      route,
      message,
      timestamp: new Date().toISOString(),
    })
  );
}

/**
 * Best-effort human-readable message + extra fields from an arbitrary thrown
 * value. Supabase's PostgrestError (and similar SDK errors) are plain
 * objects, not `instanceof Error` — String(error) on those degrades to
 * "[object Object]", so pull out a `.message` property when present, and
 * fall back to a JSON dump rather than losing the error entirely.
 */
function describeError(error: unknown): { message: string; extra?: LogContext } {
  if (error instanceof Error) return { message: error.message };
  if (error && typeof error === "object") {
    const { message, ...rest } = error as Record<string, unknown>;
    if (typeof message === "string") return { message, extra: rest };
    try {
      return { message: JSON.stringify(error) };
    } catch {
      return { message: String(error) };
    }
  }
  return { message: String(error) };
}

export function logError(route: string, error: unknown, context?: LogContext) {
  const { message, extra } = describeError(error);
  emit("error", route, message, {
    ...extra,
    ...context,
    stack: error instanceof Error ? error.stack : undefined,
  });
}

export function logWarn(route: string, message: string, context?: LogContext) {
  emit("warn", route, message, context);
}
