/**
 * Small retry-with-backoff helper for transient upstream failures (e.g. a
 * Gemini "model overloaded" 503). Deliberately minimal: no dependency, no
 * jitter — just enough to absorb a brief spike without compounding a real
 * outage or a hang into a much longer request.
 */

/**
 * True for errors that are worth a retry: the Gemini SDK's ApiError carries
 * its JSON body as the error message, shaped like
 * {"error":{"code":503,"status":"UNAVAILABLE"}}. A TimeoutError is
 * deliberately NOT retryable here — it already exhausted its own timeout
 * budget, and retrying it would risk compounding toward the route's
 * maxDuration rather than failing fast.
 */
export function isRetryableError(error: unknown): boolean {
  if (error instanceof Error && error.name === "TimeoutError") return false;

  const message = error instanceof Error ? error.message : String(error);
  try {
    const parsed = JSON.parse(message) as { error?: { code?: number; status?: string } };
    const code = parsed.error?.code;
    const status = parsed.error?.status;
    return code === 503 || code === 429 || status === "UNAVAILABLE" || status === "RESOURCE_EXHAUSTED";
  } catch {
    return false;
  }
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  options: { retries?: number; baseDelayMs?: number } = {}
): Promise<T> {
  const { retries = 1, baseDelayMs = 600 } = options;

  for (let attempt = 0; ; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (attempt >= retries || !isRetryableError(err)) throw err;
      await new Promise((resolve) => setTimeout(resolve, baseDelayMs * 2 ** attempt));
    }
  }
}
