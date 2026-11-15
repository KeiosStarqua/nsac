import { describe, expect, it } from "vitest";
import { filterModelIds, sanitizeProfileModels } from "./catalogFilter";

const cat = [{ id: "a" }, { id: "b" }];

describe("catalogFilter", () => {
  it("keeps in-catalog ids", () => {
    expect(filterModelIds(cat, ["a", "b"]).kept).toEqual(["a", "b"]);
    expect(filterModelIds(cat, ["a", "b"]).dropped).toEqual([]);
  });
  it("drops foreign ids", () => {
    const r = filterModelIds(cat, ["a", "x", "b", "y"]);
    expect(r.kept).toEqual(["a", "b"]);
    expect(r.dropped).toEqual(["x", "y"]);
  });
  it("ignores empty strings (not counted as dropped)", () => {
    const r = filterModelIds(cat, ["", "a", null, undefined]);
    expect(r.kept).toEqual(["a"]);
    expect(r.dropped).toEqual([]);
  });
  it("null/undefined safe", () => {
    expect(filterModelIds(cat, [null, undefined]).kept).toEqual([]);
    expect(filterModelIds(cat, [null, undefined]).dropped).toEqual([]);
  });
  it("sanitizeProfileModels keeps in-catalog, drops foreign, counts dropped", () => {
    const r = sanitizeProfileModels(cat, { "sky-chat": "a", "sky-x": "x", "sky-empty": "" });
    expect(r.models).toEqual({ "sky-chat": "a", "sky-empty": "" });
    expect(r.dropped).toBe(1);
  });
  it("sanitizeProfileModels all foreign dropped count", () => {
    const r = sanitizeProfileModels(cat, { a: "x", b: "y" });
    expect(r.models).toEqual({});
    expect(r.dropped).toBe(2);
  });
});