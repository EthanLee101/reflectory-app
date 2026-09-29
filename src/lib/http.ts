/**
 * Parses a request's JSON body, returning `null` for a malformed body or one
 * that isn't a JSON object. Lets route handlers answer 400 instead of throwing
 * an unhandled SyntaxError (which would also strand an already-claimed
 * idempotency key in "pending").
 */
export async function readJsonBody(
  request: Request
): Promise<Record<string, unknown> | null> {
  try {
    const body: unknown = await request.json();
    if (body && typeof body === "object" && !Array.isArray(body)) {
      return body as Record<string, unknown>;
    }
    return null;
  } catch {
    return null;
  }
}
