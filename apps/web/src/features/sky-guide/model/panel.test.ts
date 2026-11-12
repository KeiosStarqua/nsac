import { describe, expect, it } from "vitest";
import { initialPanel, panelReducer, visibleProgram, type PanelEvent, type PanelState } from "./panel";

const PRESET = 'root = SkyCard("Preset", [])';
const run = (events: PanelEvent[]): PanelState =>
  events.reduce((state, event) => panelReducer(state, event, PRESET), initialPanel);

describe("panel state", () => {
  it("shows nothing before Sky arrives, then the preset at once", () => {
    expect(visibleProgram(initialPanel, PRESET, "")).toBeNull();
    expect(visibleProgram(run([{ type: "arrive" }]), PRESET, "")).toBe(PRESET);
  });

  it("streams the draft in place of the preset", () => {
    const state = run([{ type: "arrive" }, { type: "chunk", text: "root = " }, { type: "chunk", text: "SkyCard" }]);
    expect(state).toEqual({ kind: "composing", draft: "root = SkyCard" });
    expect(visibleProgram(state, PRESET, "root = SkyCard")).toBe("root = SkyCard");
  });

  it("keeps an accepted program and falls back to the preset otherwise", () => {
    const accepted = run([{ type: "arrive" }, { type: "end", accepted: true, program: "P" }]);
    expect(accepted).toEqual({ kind: "settled", program: "P", origin: "model" });

    const rejected = run([{ type: "arrive" }, { type: "end", accepted: false, program: "P" }]);
    expect(rejected).toEqual({ kind: "settled", program: PRESET, origin: "rejected" });

    const offline = run([{ type: "arrive" }, { type: "chunk", text: "x" }, { type: "unavailable" }]);
    expect(offline).toEqual({ kind: "settled", program: PRESET, origin: "offline" });
  });

  it("ignores stream events once settled", () => {
    const settled = run([{ type: "arrive" }, { type: "unavailable" }, { type: "chunk", text: "late" }]);
    expect(settled.kind).toBe("settled");
  });

  it("re-arms an offline-settled panel when Sky re-asks (after a key was saved)", () => {
    const reArmed = run([{ type: "arrive" }, { type: "unavailable" }, { type: "arrive" }]);
    expect(reArmed).toEqual({ kind: "composing", draft: "" });

    // …but a settled "model" or "rejected" panel is left alone.
    const model = run([{ type: "arrive" }, { type: "end", accepted: true, program: "P" }, { type: "arrive" }]);
    expect(model).toEqual({ kind: "settled", program: "P", origin: "model" });
    const rejected = run([{ type: "arrive" }, { type: "end", accepted: false, program: "P" }, { type: "arrive" }]);
    expect(rejected).toEqual({ kind: "settled", program: PRESET, origin: "rejected" });
  });
});
