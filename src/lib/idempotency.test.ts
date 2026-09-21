import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  claimIdempotencyKey,
  completeIdempotencyKey,
  releaseIdempotencyKey,
} from "@/lib/idempotency";

function makeBuilder(result: unknown) {
  const builder: Record<string, unknown> = {
    upsert: vi.fn(() => builder),
    select: vi.fn(() => builder),
    maybeSingle: vi.fn(() => Promise.resolve(result)),
    eq: vi.fn(() => builder),
    update: vi.fn(() => builder),
    delete: vi.fn(() => builder),
    then: (resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) =>
      Promise.resolve(result).then(resolve, reject),
  };
  return builder;
}

const fromMock = vi.fn();
const fakeSupabase = { from: fromMock } as never;

beforeEach(() => {
  fromMock.mockReset();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("claimIdempotencyKey", () => {
  it("returns replay: false on a fresh insert", async () => {
    fromMock.mockReturnValueOnce(makeBuilder({ data: { key: "k1" }, error: null }));
    const result = await claimIdempotencyKey(fakeSupabase, "k1", "reflect");
    expect(result).toEqual({ replay: false });
  });

  it("fails open (replay: false) when the insert errors", async () => {
    fromMock.mockReturnValueOnce(
      makeBuilder({ data: null, error: { message: "db unreachable" } })
    );
    const result = await claimIdempotencyKey(fakeSupabase, "k1", "reflect");
    expect(result).toEqual({ replay: false });
  });

  it("replays the cached response when the prior attempt is done and within TTL", async () => {
    fromMock.mockReturnValueOnce(makeBuilder({ data: null, error: null }));
    fromMock.mockReturnValueOnce(
      makeBuilder({
        data: {
          status: "done",
          response: { reflection: "hi" },
          status_code: 200,
          created_at: new Date().toISOString(),
        },
        error: null,
      })
    );
    const result = await claimIdempotencyKey(fakeSupabase, "k1", "reflect", 300);
    expect(result).toEqual({
      replay: true,
      response: { reflection: "hi" },
      statusCode: 200,
    });
  });

  it("returns conflict when a duplicate request is still in flight (pending)", async () => {
    fromMock.mockReturnValueOnce(makeBuilder({ data: null, error: null }));
    fromMock.mockReturnValueOnce(
      makeBuilder({
        data: {
          status: "pending",
          response: null,
          status_code: null,
          created_at: new Date().toISOString(),
        },
        error: null,
      })
    );
    const result = await claimIdempotencyKey(fakeSupabase, "k1", "reflect");
    expect(result).toEqual({ replay: "conflict" });
  });

  it("returns conflict when the prior done attempt is past its TTL", async () => {
    fromMock.mockReturnValueOnce(makeBuilder({ data: null, error: null }));
    const staleCreatedAt = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    fromMock.mockReturnValueOnce(
      makeBuilder({
        data: {
          status: "done",
          response: { reflection: "hi" },
          status_code: 200,
          created_at: staleCreatedAt,
        },
        error: null,
      })
    );
    const result = await claimIdempotencyKey(fakeSupabase, "k1", "reflect", 300);
    expect(result).toEqual({ replay: "conflict" });
  });
});

describe("completeIdempotencyKey", () => {
  it("updates the row with the final status and response", async () => {
    const builder = makeBuilder({ error: null });
    fromMock.mockReturnValueOnce(builder);
    await completeIdempotencyKey(fakeSupabase, "k1", "reflect", { ok: true }, 200);
    expect(builder.update).toHaveBeenCalledWith({
      status: "done",
      response: { ok: true },
      status_code: 200,
    });
  });
});

describe("releaseIdempotencyKey", () => {
  it("deletes the claimed key", async () => {
    const builder = makeBuilder({ error: null });
    fromMock.mockReturnValueOnce(builder);
    await releaseIdempotencyKey(fakeSupabase, "k1", "reflect");
    expect(builder.delete).toHaveBeenCalled();
  });
});
