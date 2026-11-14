import { describe, expect, test } from "vitest";
import { parseClaims, takenIdsOf } from "./claims";

describe("parseClaims", () => {
  test("parses well-formed claims", () => {
    const claims = parseClaims([
      { astronautId: "ayla-reyes", mine: false },
      { astronautId: "lena-fischer", mine: true },
    ]);
    expect(claims).toEqual([
      { astronautId: "ayla-reyes", mine: false },
      { astronautId: "lena-fischer", mine: true },
    ]);
  });

  test("non-array payloads yield []", () => {
    for (const bad of [null, undefined, {}, "oops", 42, true]) {
      expect(parseClaims(bad)).toEqual([]);
    }
  });

  test("drops malformed entries, keeps the good ones", () => {
    const claims = parseClaims([
      { astronautId: "ayla-reyes", mine: false },
      { astronautId: "", mine: false },
      { astronautId: "lena-fischer" },
      { astronautId: "tomas-ortega", mine: "yes" },
      "garbage",
      42,
      null,
      { astronautId: "yuki-tanaka", mine: true },
    ]);
    expect(claims.map((c) => c.astronautId)).toEqual(["ayla-reyes", "yuki-tanaka"]);
  });

  test("duplicate ids keep the first entry", () => {
    const claims = parseClaims([
      { astronautId: "ayla-reyes", mine: false },
      { astronautId: "ayla-reyes", mine: true },
    ]);
    expect(claims).toEqual([{ astronautId: "ayla-reyes", mine: false }]);
  });

  test("trims ids and treats whitespace-only ids as malformed", () => {
    const claims = parseClaims([
      { astronautId: "  ayla-reyes  ", mine: false },
      { astronautId: "   ", mine: false },
    ]);
    expect(claims).toEqual([{ astronautId: "ayla-reyes", mine: false }]);
  });
});

describe("takenIdsOf", () => {
  const claims = [
    { astronautId: "ayla-reyes", mine: false },
    { astronautId: "lena-fischer", mine: true },
    { astronautId: "tomas-ortega", mine: false },
  ];

  test("collects other sessions' claims only", () => {
    expect([...takenIdsOf(claims)].sort()).toEqual(["ayla-reyes", "tomas-ortega"]);
  });

  test("excludes my astronaut even if flagged not-mine (stale flag)", () => {
    expect(takenIdsOf(claims, "ayla-reyes").has("ayla-reyes")).toBe(false);
    expect([...takenIdsOf(claims, "ayla-reyes")]).toEqual(["tomas-ortega"]);
  });

  test("empty claims → empty set", () => {
    expect(takenIdsOf([]).size).toBe(0);
    expect(takenIdsOf([], "ayla-reyes").size).toBe(0);
  });
});
