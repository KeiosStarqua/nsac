// Pure state of one station panel: from "Sky has not landed here" to a settled program.

export type PanelOrigin = "model" | "offline" | "rejected";

export type PanelState =
  | { readonly kind: "waiting" }
  /** Sky landed. The preset shows until the model's first chunk, then the draft streams in its place. */
  | { readonly kind: "composing"; readonly draft: string }
  | { readonly kind: "settled"; readonly program: string; readonly origin: PanelOrigin };

export type PanelEvent =
  | { readonly type: "arrive" }
  /** The viewer asked for something different; the panel composes again from scratch. */
  | { readonly type: "recompose" }
  | { readonly type: "chunk"; readonly text: string }
  /** The stream ended. `accepted` is the verdict of `reviewProgram` on the finished draft. */
  | { readonly type: "end"; readonly accepted: boolean; readonly program: string }
  | { readonly type: "unavailable" }
  | { readonly type: "restore"; readonly program: string; readonly origin: PanelOrigin };

export const initialPanel: PanelState = { kind: "waiting" };

export function panelReducer(state: PanelState, event: PanelEvent, preset: string): PanelState {
  switch (event.type) {
    case "arrive":
      if (state.kind === "waiting") return { kind: "composing", draft: "" };
      // A settled "model unavailable" panel tries again when Sky re-asks (e.g. after a key was saved).
      if (state.kind === "settled" && state.origin === "offline") return { kind: "composing", draft: "" };
      return state;
    case "recompose":
      return { kind: "composing", draft: "" };
    case "chunk":
      return state.kind === "composing" ? { kind: "composing", draft: state.draft + event.text } : state;
    case "end":
      if (state.kind !== "composing") return state;
      return event.accepted
        ? { kind: "settled", program: event.program, origin: "model" }
        : { kind: "settled", program: preset, origin: "rejected" };
    case "unavailable":
      return state.kind === "composing" ? { kind: "settled", program: preset, origin: "offline" } : state;
    case "restore":
      return { kind: "settled", program: event.program, origin: event.origin };
  }
}

/** The program to render right now, or `null` while Sky has not landed. */
export function visibleProgram(state: PanelState, preset: string, draftProgram: string): string | null {
  switch (state.kind) {
    case "waiting":
      return null;
    case "composing":
      return draftProgram.length > 0 ? draftProgram : preset;
    case "settled":
      return state.program;
  }
}
