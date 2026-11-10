import { describe, expect, it } from "vitest";
import { en } from "~/shared/i18n/en";
import { vi } from "~/shared/i18n/vi";
import { FACT_IDS, FACT_META, STATION_IDS } from "~/shared/sky";
import { extractProgram, reviewProgram } from "../model/program";
import { parseSkyProgram } from "./library";

const LOCALES = { en, vi };

describe("built-in panels", () => {
  for (const [locale, copy] of Object.entries(LOCALES)) {
    for (const station of STATION_IDS) {
      it(`${locale}/${station} passes the same review as a model panel`, () => {
        expect(reviewProgram(copy.sky.stations[station].preset, station, parseSkyProgram)).toEqual({ ok: true });
      });
    }
  }
});

describe("reviewProgram on model output", () => {
  const ok = 'root = SkyCard("Hi", [s])\ns = Say("Hello from Sky")';

  it("accepts a clean program, also when wrapped in a fence", () => {
    expect(reviewProgram(extractProgram("```openui\n" + ok + "\n```"), "pipeline", parseSkyProgram).ok).toBe(true);
  });

  it("rejects digits in free text", () => {
    const review = reviewProgram('root = SkyCard("Hi", [s])\ns = Say("Your HR is 120")', "pipeline", parseSkyProgram);
    expect(review).toMatchObject({ ok: false, reasons: ["digit in free text"] });
  });

  it("rejects a fact the station does not allow", () => {
    const review = reviewProgram('root = SkyCard("Hi", [f])\nf = Fact("radiationCareer")', "pipeline", parseSkyProgram);
    expect(review.ok).toBe(false);
  });

  it("rejects unknown components and unresolved references", () => {
    expect(reviewProgram('root = SkyCard("Hi", [Button("Go")])', "pipeline", parseSkyProgram).ok).toBe(false);
    expect(reviewProgram('root = SkyCard("Hi", [missing])', "pipeline", parseSkyProgram).ok).toBe(false);
  });
});

describe("facts", () => {
  it("match the NASA-STD-3001 table on the landing page, in both languages", () => {
    for (const copy of Object.values(LOCALES)) {
      for (const id of FACT_IDS) {
        const requirement = FACT_META[id].requirement;
        if (!requirement) continue;
        const row = copy.data.rows.find((candidate) => candidate.requirement === requirement);
        expect(row?.standard, `${id} ${requirement}`).toBe(copy.sky.facts[id].value);
      }
    }
  });
});
