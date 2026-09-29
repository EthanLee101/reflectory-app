import { describe, it, expect } from "vitest";
import { readJsonBody } from "@/lib/http";

const req = (body: string) => new Request("http://localhost/x", { method: "POST", body });

describe("readJsonBody", () => {
  it("returns a parsed JSON object", async () => {
    expect(await readJsonBody(req('{"content":"hi"}'))).toEqual({ content: "hi" });
  });

  it("returns null for malformed JSON", async () => {
    expect(await readJsonBody(req("{not json"))).toBeNull();
  });

  it("returns null for an empty body", async () => {
    expect(await readJsonBody(req(""))).toBeNull();
  });

  it("returns null for JSON that is not an object", async () => {
    expect(await readJsonBody(req("null"))).toBeNull();
    expect(await readJsonBody(req('"text"'))).toBeNull();
    expect(await readJsonBody(req("[1,2]"))).toBeNull();
  });
});
