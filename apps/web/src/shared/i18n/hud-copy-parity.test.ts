import { describe, expect, test } from "vitest";
import { en } from "./en";
import { vi } from "./vi";

// `hudMock.*` is the copy of the `/` console. The `Copy` type already forces both locales to
// carry the same keys; these assertions cover what the type cannot: no empty leaf, the same
// `{placeholders}` on both sides, and real translation on the strings a reader actually sees.

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

describe("hudMock.* i18n", () => {
  test("en and vi carry the same hudMock key set", () => {
    const enKeys = flattenKeys(en.hudMock, "hudMock").sort();
    const viKeys = flattenKeys(vi.hudMock, "hudMock").sort();
    expect(viKeys).toEqual(enKeys);
  });

  test("every hudMock leaf is a non-empty string", () => {
    for (const [locale, copy] of [
      ["en", en],
      ["vi", vi],
    ] as const) {
      for (const [path, text] of leaves(copy.hudMock)) {
        expect(text.trim().length, `empty hudMock.${path} in ${locale}`).toBeGreaterThan(0);
      }
    }
  });

  test("both locales keep the same placeholders for every template", () => {
    const enLeaves = new Map(leaves(en.hudMock));
    for (const [path, text] of leaves(vi.hudMock)) {
      expect(placeholders(text), `placeholder mismatch at hudMock.${path}`).toEqual(
        placeholders(enLeaves.get(path) ?? ""),
      );
    }
  });

  test("reader-facing strings are actually translated", () => {
    const translated: Array<keyof typeof en.hudMock> = [
      "profileTitle",
      "profileSimulated",
      "vitalsTitle",
      "trendsTitle",
      "readinessTitle",
      "readinessGuidance",
      "insightText",
      "cardActivity",
      "cardEnergyBurned",
      "cardEnergyIntake",
      "detailClose",
    ];
    for (const key of translated) {
      expect(String(vi.hudMock[key]), `hudMock.${String(key)} is not translated`).not.toBe(
        String(en.hudMock[key]),
      );
    }
    for (const tab of ["body", "recovery", "cognitive", "energy"] as const) {
      expect(vi.hudMock.tabs[tab]).not.toBe(en.hudMock.tabs[tab]);
    }
    for (const role of [
      "commander",
      "flightEngineer",
      "medicalOfficer",
      "missionSpecialist",
      "payloadSpecialist",
    ] as const) {
      expect(vi.hudMock.roles[role]).not.toBe(en.hudMock.roles[role]);
    }
  });
});
