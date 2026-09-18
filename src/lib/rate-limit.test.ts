import { describe, it, expect, vi, beforeEach } from "vitest";
import { checkRateLimit } from "@/lib/rate-limit";

const rpcMock = vi.fn();
const fakeSupabase = { rpc: rpcMock } as never;

beforeEach(() => {
  rpcMock.mockReset();
});

describe("checkRateLimit", () => {
  it("calls check_rate_limit with the entries:write limits", async () => {
    rpcMock.mockResolvedValue({ data: true, error: null });
    await checkRateLimit(fakeSupabase, "entries:write");
    expect(rpcMock).toHaveBeenCalledWith("check_rate_limit", {
      p_route: "entries:write",
      p_limit: 20,
      p_window_seconds: 300,
    });
  });

  it("calls check_rate_limit with the reflect limits", async () => {
    rpcMock.mockResolvedValue({ data: true, error: null });
    await checkRateLimit(fakeSupabase, "reflect");
    expect(rpcMock).toHaveBeenCalledWith("check_rate_limit", {
      p_route: "reflect",
      p_limit: 15,
      p_window_seconds: 300,
    });
  });

  it("calls check_rate_limit with the search limits", async () => {
    rpcMock.mockResolvedValue({ data: true, error: null });
    await checkRateLimit(fakeSupabase, "search");
    expect(rpcMock).toHaveBeenCalledWith("check_rate_limit", {
      p_route: "search",
      p_limit: 30,
      p_window_seconds: 300,
    });
  });

  it("returns true when the RPC reports the limit was not exceeded", async () => {
    rpcMock.mockResolvedValue({ data: true, error: null });
    const result = await checkRateLimit(fakeSupabase, "reflect");
    expect(result).toBe(true);
  });

  it("returns false when the RPC reports the limit was exceeded", async () => {
    rpcMock.mockResolvedValue({ data: false, error: null });
    const result = await checkRateLimit(fakeSupabase, "reflect");
    expect(result).toBe(false);
  });

  it("fails open (returns true) when the RPC errors", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    rpcMock.mockResolvedValue({ data: null, error: { message: "db unreachable" } });
    const result = await checkRateLimit(fakeSupabase, "entries:write");
    expect(result).toBe(true);
    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });
});
