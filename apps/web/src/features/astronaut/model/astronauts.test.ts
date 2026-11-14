import { describe, expect, test } from "vitest";
import {
  ASTRONAUTS,
  DEFAULT_ASTRONAUT_ID,
  astronautForKey,
  findAstronaut,
  firstName,
  initials,
  moveSelection,
  moveSelectionAvailable,
  normalizeAstronautId,
  parseAstronautRows,
} from "./astronauts";

describe("roster", () => {
  test("has six fictional crew with unique ids", () => {
    expect(ASTRONAUTS).toHaveLength(6);
    expect(new Set(ASTRONAUTS.map((a) => a.id)).size).toBe(6);
    expect(ASTRONAUTS.every((a) => a.id.length > 0 && a.name.length > 0)).toBe(true);
  });

  test("defaults to Ayla Reyes", () => {
    expect(DEFAULT_ASTRONAUT_ID).toBe("ayla-reyes");
    expect(findAstronaut(DEFAULT_ASTRONAUT_ID)?.name).toBe("Ayla Reyes");
  });

  test("resolves legacy short ids from the first picker", () => {
    expect(normalizeAstronautId("ayla")).toBe("ayla-reyes");
    expect(findAstronaut("dae")?.name).toBe("Dae-Jung Park");
    expect(findAstronaut("lena")?.id).toBe("lena-fischer");
  });

  test("rejects empty and unknown ids", () => {
    expect(normalizeAstronautId(null)).toBeNull();
    expect(normalizeAstronautId("  ")).toBeNull();
    expect(findAstronaut("nobody")).toBeNull();
  });
});

describe("keyboard selection", () => {
  test("digits 1-6 map to the six cards", () => {
    for (let i = 1; i <= 6; i += 1) {
      expect(astronautForKey(String(i))?.id).toBe(ASTRONAUTS[i - 1]!.id);
    }
  });

  test("other keys are ignored", () => {
    for (const key of ["0", "7", "a", "Enter", "ArrowLeft", ""]) {
      expect(astronautForKey(key)).toBeNull();
    }
  });

  test("arrow movement wraps at both ends", () => {
    expect(moveSelection(ASTRONAUTS, "ayla-reyes", -1)?.id).toBe("noor-abbasi");
    expect(moveSelection(ASTRONAUTS, "noor-abbasi", 1)?.id).toBe("ayla-reyes");
    expect(moveSelection(ASTRONAUTS, "lena-fischer", 1)?.id).toBe("tomas-ortega");
  });

  test("unknown current id starts from the first card", () => {
    expect(moveSelection(ASTRONAUTS, null, 1)?.id).toBe(ASTRONAUTS[1]!.id);
  });

  test("skips taken cards, wraps at both ends", () => {
    const taken = new Set(["dae-jung-park"]);
    // ayla-reyes → next available is lena-fischer (dae taken)
    expect(moveSelectionAvailable(ASTRONAUTS, taken, "ayla-reyes", 1)?.id).toBe("lena-fischer");
    // lena-fischer → previous available is ayla-reyes (dae taken)
    expect(moveSelectionAvailable(ASTRONAUTS, taken, "lena-fischer", -1)?.id).toBe("ayla-reyes");
    // noor-abbasi → forward wraps to ayla-reyes
    expect(moveSelectionAvailable(ASTRONAUTS, taken, "noor-abbasi", 1)?.id).toBe("ayla-reyes");
  });

  test("consistent behavior when everything is taken or current card is taken", () => {
    const all = new Set(ASTRONAUTS.map((a) => a.id));
    expect(moveSelectionAvailable(ASTRONAUTS, all, "ayla-reyes", 1)).toBeNull();
    // current card taken but others available → lands on the next available card
    const taken = new Set(["ayla-reyes"]);
    expect(moveSelectionAvailable(ASTRONAUTS, taken, "ayla-reyes", 1)?.id).toBe("dae-jung-park");
    // delta larger than one step moves that many available cards
    expect(moveSelectionAvailable(ASTRONAUTS, new Set(["dae-jung-park"]), "ayla-reyes", 2)?.id).toBe("tomas-ortega");
  });
});

describe("names", () => {
  test("firstName keeps only the first word", () => {
    expect(firstName("Ayla Reyes")).toBe("Ayla");
    expect(firstName("  Dae-Jung  Park ")).toBe("Dae-Jung");
  });

  test("initials use first and last name", () => {
    expect(initials("Ayla Reyes")).toBe("AR");
    expect(initials("Noor Abbasi")).toBe("NA");
    expect(initials("Cher")).toBe("C");
  });
});

describe("backend rows", () => {
  const rows = [
    { id: "ayla-reyes", name: "Ayla Reyes", roleCode: "CDR-01", callsign: "Ayla", bio: "Commander" },
    { id: "yuki-tanaka", name: "Yuki Tanaka", roleCode: "MS-05", callsign: "Yuki", bio: null },
  ];

  test("maps role code and bio onto the card", () => {
    const [first, second] = parseAstronautRows(rows);
    expect(first).toEqual({ id: "ayla-reyes", name: "Ayla Reyes", role: "Commander", initial: "AR", callsign: "CDR-01" });
    expect(second?.role).toBe("MS-05");
  });

  test("drops malformed and duplicate rows", () => {
    const parsed = parseAstronautRows([
      ...rows,
      { id: "ayla-reyes", name: "Duplicate", roleCode: "X" },
      { id: "", name: "No id", roleCode: "X" },
      { id: "no-role", name: "No role" },
      "nope",
    ]);
    expect(parsed.map((a) => a.id)).toEqual(["ayla-reyes", "yuki-tanaka"]);
  });

  test("non-array payloads yield an empty list so the fixture is used", () => {
    expect(parseAstronautRows(null)).toEqual([]);
    expect(parseAstronautRows({})).toEqual([]);
    expect(parseAstronautRows("error")).toEqual([]);
  });
});
