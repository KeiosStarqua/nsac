import { describe, expect, test } from "vitest";
import { en } from "./en";
import { vi } from "./vi";

// `live.*` is the copy of the `/performance` live vitals strip. Same rules as the other parity
// tests: the `Copy` type forces both locales to carry the same keys, and these assertions cover
// what the type cannot — no empty leaf, the same placeholders, real translation on reader-facing
// strings.

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

describe("live.* i18n", () => {
  test("en and vi carry the same live key set", () => {
    const enKeys = flattenKeys(en.live, "live").sort();
    const viKeys = flattenKeys(vi.live, "live").sort();
    expect(viKeys).toEqual(enKeys);
  });

  test("every live leaf is a non-empty string", () => {
    for (const [locale, copy] of [
      ["en", en],
      ["vi", vi],
    ] as const) {
      for (const [path, text] of leaves(copy.live)) {
        expect(text.trim().length, `empty live.${path} in ${locale}`).toBeGreaterThan(0);
      }
    }
  });

  test("both locales keep the same placeholders for every template", () => {
    const enLeaves = new Map(leaves(en.live));
    for (const [path, text] of leaves(vi.live)) {
      expect(placeholders(text), `placeholder mismatch at live.${path}`).toEqual(
        placeholders(enLeaves.get(path) ?? ""),
      );
    }
  });

  test("reader-facing strings are actually translated", () => {
    const translated: Array<keyof typeof en.live> = [
      "stripAria",
      "visibleLive",
      "historicalLabel",
      "offlineLabel",
      "lastUpdated",
      "metricHeartRate",
      "metricRespiratoryRate",
      "metricCoreTemperature",
      "metricBloodPressure",
      "metricActivity",
    ];
    for (const key of translated) {
      expect(String(vi.live[key]), `live.${String(key)} is not translated`).not.toBe(String(en.live[key]));
    }
  });

  test("the three strip labels stay distinct and carry the simulated wording", () => {
    expect(en.live.visibleLive).not.toBe(en.live.historicalLabel);
    expect(en.live.historicalLabel).not.toBe(en.live.offlineLabel);
    expect(en.live.visibleLive.toLowerCase()).toContain("simulated");
    expect(en.live.historicalLabel.toLowerCase()).toContain("simulated");
    expect(vi.live.visibleLive.toLowerCase()).toContain("mô phỏng");
  });
});
