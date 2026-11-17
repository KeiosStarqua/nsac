import { describe, expect, test } from "vitest";
import { en } from "./en";
import { vi } from "./vi";

// `notebooks.*` is the copy of the `/notebooks` chrome, plus the `hud.notebooksButton*` chip on
// the `/` console header. Same rules as the other parity tests: the `Copy` type forces both
// locales to carry the same keys, and these assertions cover what the type cannot — no empty
// leaf, the same placeholders, real translation on reader-facing strings.

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

describe("notebooks.* i18n", () => {
  test("en and vi carry the same notebooks key set", () => {
    const enKeys = flattenKeys(en.notebooks, "notebooks").sort();
    const viKeys = flattenKeys(vi.notebooks, "notebooks").sort();
    expect(viKeys).toEqual(enKeys);
  });

  test("every notebooks leaf is a non-empty string", () => {
    for (const [locale, copy] of [
      ["en", en],
      ["vi", vi],
    ] as const) {
      for (const [path, text] of leaves(copy.notebooks)) {
        expect(text.trim().length, `empty notebooks.${path} in ${locale}`).toBeGreaterThan(0);
      }
    }
  });

  test("both locales keep the same placeholders for every template", () => {
    const enLeaves = new Map(leaves(en.notebooks));
    for (const [path, text] of leaves(vi.notebooks)) {
      expect(placeholders(text), `placeholder mismatch at notebooks.${path}`).toEqual(
        placeholders(enLeaves.get(path) ?? ""),
      );
    }
  });

  test("reader-facing strings are actually translated", () => {
    for (const key of ["back", "openNewTab", "fallback"] as const) {
      expect(vi.notebooks[key], `notebooks.${key} is not translated`).not.toBe(en.notebooks[key]);
    }
    expect(vi.hud.notebooksButton).not.toBe(en.hud.notebooksButton);
    expect(vi.hud.notebooksButtonAria).not.toBe(en.hud.notebooksButtonAria);
  });

  test("hud carries the NOTEBOOKS chip labels in both locales", () => {
    for (const copy of [en, vi]) {
      expect(copy.hud.notebooksButton.trim().length).toBeGreaterThan(0);
      expect(copy.hud.notebooksButtonAria.trim().length).toBeGreaterThan(0);
    }
  });
});
