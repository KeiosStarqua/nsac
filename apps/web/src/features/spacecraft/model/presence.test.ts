import { describe, expect, it } from "vitest";
import type { Astronaut, ClaimEntry } from "~/features/astronaut";
import { checkedInCount, resolveCrewPresence } from "./presence";

const crew: Astronaut[] = [
  { id: "ayla-reyes", name: "Ayla Reyes", role: "Commander", initial: "AR", callsign: "CDR-01" },
  { id: "dae-jung-park", name: "Dae-Jung Park", role: "Flight Engineer", initial: "DP", callsign: "FE-02" },
  { id: "lena-fischer", name: "Lena Fischer", role: "Medical Officer", initial: "LF", callsign: "MO-03" },
];

const claim = (astronautId: string, mine = false): ClaimEntry => ({ astronautId, mine });

describe("resolveCrewPresence", () => {
  it("marks every crew member free when nobody has claimed", () => {
    const presence = resolveCrewPresence(crew, []);
    expect(presence.map((entry) => entry.state)).toEqual(["free", "free", "free"]);
    expect(presence.map((entry) => entry.astronaut.id)).toEqual(crew.map((a) => a.id));
    expect(checkedInCount(presence)).toBe(0);
  });

  it("separates my own claim from another session's claim", () => {
    const presence = resolveCrewPresence(crew, [claim("lena-fischer", true), claim("dae-jung-park")]);
    expect(presence.map((entry) => entry.state)).toEqual(["free", "taken", "mine"]);
    expect(checkedInCount(presence)).toBe(2);
  });

  it("keeps crew order regardless of claim order", () => {
    const presence = resolveCrewPresence(crew, [claim("lena-fischer"), claim("ayla-reyes", true)]);
    expect(presence.map((entry) => entry.astronaut.id)).toEqual([
      "ayla-reyes",
      "dae-jung-park",
      "lena-fischer",
    ]);
    expect(presence.map((entry) => entry.state)).toEqual(["mine", "free", "taken"]);
  });

  it("lets mine win over a stale taken entry for the same crew id", () => {
    const presence = resolveCrewPresence(crew, [claim("ayla-reyes"), claim("ayla-reyes", true)]);
    expect(presence[0]?.state).toBe("mine");
  });

  it("ignores claim ids the bundled roster does not know", () => {
    const presence = resolveCrewPresence(crew, [claim("ghost-crew"), claim("ayla-reyes", true)]);
    expect(presence.map((entry) => entry.state)).toEqual(["mine", "free", "free"]);
    expect(checkedInCount(presence)).toBe(1);
  });

  it("handles an empty roster", () => {
    expect(resolveCrewPresence([], [claim("ayla-reyes", true)])).toEqual([]);
  });
});
