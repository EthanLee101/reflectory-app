import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { logError, logWarn } from "@/lib/logger";

let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
let consoleWarnSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  consoleErrorSpy.mockRestore();
  consoleWarnSpy.mockRestore();
});

function lastErrorLog() {
  const call = consoleErrorSpy.mock.calls.at(-1);
  return JSON.parse(call?.[0] as string);
}

describe("logError", () => {
  it("uses an Error's own message and stack", () => {
    const err = new Error("boom");
    logError("someRoute", err);
    const log = lastErrorLog();
    expect(log.message).toBe("boom");
    expect(log.route).toBe("someRoute");
    expect(typeof log.stack).toBe("string");
  });

  it("extracts .message from a non-Error, Postgrest-shaped object instead of '[object Object]'", () => {
    logError("someRoute", { message: "db unreachable", code: "PGRST000" });
    const log = lastErrorLog();
    expect(log.message).toBe("db unreachable");
    expect(log.code).toBe("PGRST000");
  });

  it("falls back to a JSON dump for a message-less object", () => {
    logError("someRoute", { code: "PGRST000", details: "no rows" });
    const log = lastErrorLog();
    expect(log.message).not.toBe("[object Object]");
    expect(JSON.parse(log.message)).toEqual({ code: "PGRST000", details: "no rows" });
  });

  it("does not let a context field named route/level/message clobber the reserved fields", () => {
    logError("realRoute", { message: "db unreachable" }, { route: "wrongRoute" });
    const log = lastErrorLog();
    expect(log.route).toBe("realRoute");
    expect(log.message).toBe("db unreachable");
  });
});

describe("logWarn", () => {
  it("logs at the warn level with the given route and message", () => {
    logWarn("someRoute", "heads up");
    const log = JSON.parse(consoleWarnSpy.mock.calls.at(-1)?.[0] as string);
    expect(log.level).toBe("warn");
    expect(log.route).toBe("someRoute");
    expect(log.message).toBe("heads up");
  });
});
