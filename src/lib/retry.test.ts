import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { withRetry, isRetryableError } from "@/lib/retry";

const RETRYABLE = new Error('{"error":{"code":503,"status":"UNAVAILABLE"}}');
const RESOURCE_EXHAUSTED = new Error(
  '{"error":{"code":429,"status":"RESOURCE_EXHAUSTED"}}'
);
const NON_RETRYABLE = new Error("boom");

function timeoutError() {
  const err = new Error("timed out");
  err.name = "TimeoutError";
  return err;
}

describe("isRetryableError", () => {
  it("is true for a 503 UNAVAILABLE Gemini error", () => {
    expect(isRetryableError(RETRYABLE)).toBe(true);
  });

  it("is true for a 429 RESOURCE_EXHAUSTED Gemini error", () => {
    expect(isRetryableError(RESOURCE_EXHAUSTED)).toBe(true);
  });

  it("is false for an unrelated error", () => {
    expect(isRetryableError(NON_RETRYABLE)).toBe(false);
  });

  it("is false for a TimeoutError, even with a retryable-shaped message", () => {
    const err = new Error('{"error":{"code":503,"status":"UNAVAILABLE"}}');
    err.name = "TimeoutError";
    expect(isRetryableError(err)).toBe(false);
  });
});

describe("withRetry", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns the result on first success without retrying", async () => {
    const fn = vi.fn().mockResolvedValue("ok");
    const result = await withRetry(fn);
    expect(result).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("retries once on a retryable failure and returns the eventual success", async () => {
    const fn = vi.fn().mockRejectedValueOnce(RETRYABLE).mockResolvedValueOnce("ok");
    const promise = withRetry(fn, { retries: 1, baseDelayMs: 10 });
    await vi.runAllTimersAsync();
    await expect(promise).resolves.toBe("ok");
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("does not retry a non-retryable error", async () => {
    const fn = vi.fn().mockRejectedValue(NON_RETRYABLE);
    await expect(withRetry(fn, { retries: 1, baseDelayMs: 10 })).rejects.toBe(
      NON_RETRYABLE
    );
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("does not retry a TimeoutError", async () => {
    const err = timeoutError();
    const fn = vi.fn().mockRejectedValue(err);
    await expect(withRetry(fn, { retries: 1, baseDelayMs: 10 })).rejects.toBe(err);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("rethrows after exhausting the configured retry count", async () => {
    const fn = vi.fn().mockRejectedValue(RETRYABLE);
    const promise = withRetry(fn, { retries: 2, baseDelayMs: 10 });
    const expectation = expect(promise).rejects.toBe(RETRYABLE);
    await vi.runAllTimersAsync();
    await expectation;
    expect(fn).toHaveBeenCalledTimes(3);
  });
});
