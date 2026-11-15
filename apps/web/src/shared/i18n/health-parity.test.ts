import { describe, expect, test } from "vitest";
import { en } from "./en";
import { vi } from "./vi";

// `health.*` is the copy of the `/health` page chrome. The `Copy` type forces both locales to
// carry the same keys; these assertions cover what the type cannot: no empty leaf, the same
// `{placeholders}` on both sides, and translated reader-facing strings.

function flattenKeys(value: unknown, prefix: string): string[] {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return [prefix];
  }
  return Object.entries(value as Record<string, unknown>).flatMap(([key, child]) =>
    flattenKeys(child, prefix === "" ? key : `${prefix}.${key}`),
  );
}

function leaves(value: unknown): Array<[string, string]> {
  if (typeof value === "string") return [["", value]];
  if (value !== null && typeof value === "object" && !Array.isArray(value)) {
    return Object.entries(value as Record<string, unknown>).flatMap(([key, child]) =>
      leaves(child).map(([path, text]) => [path === "" ? key : `${key}.${path}`, text] as [string, string]),
    );
  }
  return [];
}

function placeholders(text: string): string[] {
  return [...text.matchAll(/\{(\w+)\}/g)].map((match) => match[1]!).sort();
}

describe("health.* i18n", () => {
  test("en and vi carry the same health key set", () => {
    const enKeys = flattenKeys(en.health, "health").sort();
    const viKeys = flattenKeys(vi.health, "health").sort();
    expect(viKeys).toEqual(enKeys);
  });

  test("every health leaf is a non-empty string", () => {
    for (const [locale, copy] of [
      ["en", en],
      ["vi", vi],
    ] as const) {
      for (const [path, text] of leaves(copy.health)) {
        expect(text.trim().length, `empty health.${path} in ${locale}`).toBeGreaterThan(0);
      }
    }
  });

  test("both locales keep the same placeholders for every template", () => {
    const enLeaves = new Map(leaves(en.health));
    for (const [path, text] of leaves(vi.health)) {
      expect(placeholders(text), `placeholder mismatch at health.${path}`).toEqual(
        placeholders(enLeaves.get(path) ?? ""),
      );
    }
  });

  test("reader-facing strings are actually translated", () => {
    const translated: Array<keyof typeof en.health> = [
      "subtitle",
      "colCheck",
      "colStatus",
      "colDetail",
      "colHint",
      "liveTitle",
      "liveKey",
      "runLive",
      "copyDiag",
      "rosterTitle",
      "fixTitle",
      "fixBox",
      "fixLocal",
    ];
    for (const key of translated) {
      expect(String(vi.health[key]), `health.${String(key)} is not translated`).not.toBe(
        String(en.health[key]),
      );
    }
  });
});
