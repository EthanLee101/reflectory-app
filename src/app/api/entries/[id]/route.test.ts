import { describe, it, expect, vi, beforeEach } from "vitest";
import { MAX_ENTRY_LENGTH } from "@/lib/constants";

function makeBuilder(result: { data: unknown; error: unknown }) {
  const builder: Record<string, unknown> = {
    update: vi.fn(() => builder),
    delete: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    select: vi.fn(() => builder),
    maybeSingle: vi.fn(() => Promise.resolve(result)),
  };
  return builder;
}

const {
  getUserMock,
  createClientMock,
  fromMock,
  embedMock,
  detectCrisisMock,
  checkRateLimitMock,
} = vi.hoisted(() => ({
  getUserMock: vi.fn(),
  createClientMock: vi.fn(),
  fromMock: vi.fn(),
  embedMock: vi.fn(),
  detectCrisisMock: vi.fn(),
  checkRateLimitMock: vi.fn(),
}));

createClientMock.mockImplementation(() =>
  Promise.resolve({ auth: { getUser: getUserMock }, from: fromMock })
);

vi.mock("@/lib/supabase/server", () => ({ createClient: createClientMock }));
vi.mock("@/lib/embeddings", () => ({ embed: embedMock }));
vi.mock("@/lib/crisis", () => ({ detectCrisis: detectCrisisMock }));
vi.mock("@/lib/rate-limit", () => ({ checkRateLimit: checkRateLimitMock }));

import { PATCH, DELETE } from "@/app/api/entries/[id]/route";

function makeRequest(body: unknown) {
  return new Request("http://localhost/api/entries/e1", {
    method: "PATCH",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

function ctx(id = "e1") {
  return { params: Promise.resolve({ id }) };
}

beforeEach(() => {
  getUserMock.mockReset().mockResolvedValue({ data: { user: { id: "u1" } } });
  fromMock.mockReset();
  embedMock.mockReset();
  detectCrisisMock.mockReset();
  checkRateLimitMock.mockReset().mockResolvedValue(true);
});

describe("PATCH /api/entries/[id]", () => {
  it("returns 401 when there is no authenticated user", async () => {
    getUserMock.mockResolvedValue({ data: { user: null } });
    const res = await PATCH(makeRequest({ content: "hi" }), ctx());
    expect(res.status).toBe(401);
  });

  it("returns 429 when rate limited", async () => {
    checkRateLimitMock.mockResolvedValue(false);
    const res = await PATCH(makeRequest({ content: "hi" }), ctx());
    expect(res.status).toBe(429);
    expect(embedMock).not.toHaveBeenCalled();
    expect(detectCrisisMock).not.toHaveBeenCalled();
  });

  it("returns 400 for empty content", async () => {
    const res = await PATCH(makeRequest({ content: "   " }), ctx());
    expect(res.status).toBe(400);
  });

  it("returns 400 for content over the max length", async () => {
    const res = await PATCH(
      makeRequest({ content: "a".repeat(MAX_ENTRY_LENGTH + 1) }),
      ctx()
    );
    expect(res.status).toBe(400);
  });

  it("returns 502 when embedding or crisis detection fails", async () => {
    embedMock.mockRejectedValue(new Error("embedding service down"));
    detectCrisisMock.mockResolvedValue({ triggered: false, source: "none" });
    const res = await PATCH(makeRequest({ content: "updated" }), ctx());
    const json = await res.json();
    expect(res.status).toBe(502);
    expect(json.error).toBe("Failed to process entry");
  });

  it("returns 404 when the entry doesn't exist or isn't owned by the caller", async () => {
    embedMock.mockResolvedValue([0.1]);
    detectCrisisMock.mockResolvedValue({ triggered: false, source: "none" });
    fromMock.mockReturnValue(makeBuilder({ data: null, error: null }));
    const res = await PATCH(makeRequest({ content: "updated" }), ctx());
    expect(res.status).toBe(404);
  });

  it("updates the entry on success", async () => {
    embedMock.mockResolvedValue([0.1]);
    detectCrisisMock.mockResolvedValue({ triggered: false, source: "none" });
    const entry = { id: "e1", user_id: "u1", content: "updated", created_at: "2026-01-01" };
    fromMock.mockReturnValue(makeBuilder({ data: entry, error: null }));

    const res = await PATCH(makeRequest({ content: "updated" }), ctx());
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.entry).toEqual(entry);
    expect(json.crisis).toEqual({ triggered: false, source: "none" });
  });
});

describe("DELETE /api/entries/[id]", () => {
  function deleteRequest() {
    return new Request("http://localhost/api/entries/e1", { method: "DELETE" });
  }

  it("returns 401 when there is no authenticated user", async () => {
    getUserMock.mockResolvedValue({ data: { user: null } });
    const res = await DELETE(deleteRequest(), ctx());
    expect(res.status).toBe(401);
  });

  it("returns 404 when the entry doesn't exist or isn't owned by the caller", async () => {
    fromMock.mockReturnValue(makeBuilder({ data: null, error: null }));
    const res = await DELETE(deleteRequest(), ctx());
    expect(res.status).toBe(404);
  });

  it("returns 204 on success", async () => {
    fromMock.mockReturnValue(makeBuilder({ data: { id: "e1" }, error: null }));
    const res = await DELETE(deleteRequest(), ctx());
    expect(res.status).toBe(204);
  });
});
