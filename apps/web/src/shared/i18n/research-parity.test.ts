import { describe, expect, test } from "vitest";
import { en } from "./en";
import { vi } from "./vi";

const CARD_IDS = [
  "lv_mass",
  "lv_diastolic_volume",
  "lipid_ldl",
  "glucose",
  "vitals_sbp",
  "vitals_dbp",
  "vitals_pulse",
  "vitals_temp",
  "vitals_weight",
  "hr",
  "bone_mineral",
  "lean_mass_legs",
  "muscle_quadriceps",
  "muscle_soleus",
  "cognition_cpt_rt",
  "cognition_math_acc",
  "sleep_act",
  "sleep_act_duration",
  "fatigue",
  "mood",
  "cpet",
  "dose",
] as const;

function flattenKeys(value: unknown, prefix: string): string[] {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return [prefix];
  }
  return Object.entries(value as Record<string, unknown>).flatMap(([key, child]) =>
    flattenKeys(child, prefix === "" ? key : `${prefix}.${key}`),
  );
}

function leafStrings(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (value !== null && typeof value === "object" && !Array.isArray(value)) {
    return Object.values(value).flatMap(leafStrings);
  }
  return [];
}

describe("research.* i18n", () => {
  test("en and vi carry the same research key set", () => {
    const enKeys = flattenKeys(en.research, "research").sort();
    const viKeys = flattenKeys(vi.research, "research").sort();
    expect(viKeys).toEqual(enKeys);
  });

  test("every research leaf is a non-empty string", () => {
    for (const [locale, copy] of [
      ["en", en],
      ["vi", vi],
    ] as const) {
      for (const leaf of leafStrings(copy.research)) {
        expect(leaf.length, `empty leaf in ${locale}`).toBeGreaterThan(0);
      }
    }
  });

  test("card copy covers exactly the 22 task ids in both locales", () => {
    for (const copy of [en, vi]) {
      expect(Object.keys(copy.research.cards).sort()).toEqual([...CARD_IDS].sort());
      for (const id of CARD_IDS) {
        expect(copy.research.cards[id].title.length).toBeGreaterThan(0);
        expect(copy.research.cards[id].subtitle.length).toBeGreaterThan(0);
      }
    }
  });

  test("groups cover the 5 sections in both locales", () => {
    for (const copy of [en, vi]) {
      expect(Object.keys(copy.research.groups).sort()).toEqual(
        ["cardiometabolic", "fitnessDose", "musculoskeletal", "neuro", "sleepBehavior"].sort(),
      );
    }
  });
});
