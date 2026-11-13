// Deterministic scene planner: an intent + the simulated measurements in, a validated Scene out.
// No LLM is needed to drive the demo; the same validateScene gate would bound any future AI planner.
import { MEASUREMENTS, SIMULATED_CAVEAT, measurement, zScore, type Measurement } from "./data";
import { validateScene, type Intent, type Priority, type Scene, type SceneEntity, type UxState } from "./scene";

/** Maps each intent to the state the Core enters and the priority class (UX.md §6). */
const INTENT_STATE: Record<Intent, UxState> = {
  "daily-wellness": "understanding",
  "why-tired": "understanding",
  "recovery-deviation": "attention",
  "evidence": "understanding",
  "exercise-guidance": "decision",
  "medical-decision": "decision",
  "emergency": "emergency",
  "eva-monitoring": "attention",
  "earth-consult": "connection",
  "sleep-report": "understanding",
  "radi-exposure": "attention",
  "unknown": "understanding",
};
const INTENT_PRIORITY: Record<Intent, Priority> = {
  "daily-wellness": "P4",
  "why-tired": "P4",
  "recovery-deviation": "P2",
  "evidence": "P3",
  "exercise-guidance": "P3",
  "medical-decision": "P3",
  "emergency": "P0",
  "eva-monitoring": "P1",
  "earth-consult": "P4",
  "sleep-report": "P4",
  "radi-exposure": "P2",
  "unknown": "P4",
};
const INTENT_TITLE: Record<Intent, string> = {
  "daily-wellness": "How you are",
  "why-tired": "Why you are tired",
  "recovery-deviation": "A change in your recovery",
  "evidence": "The evidence",
  "exercise-guidance": "Today's movement",
  "medical-decision": "A decision needs you",
  "emergency": "Safety override",
  "eva-monitoring": "EVA exertion trend",
  "earth-consult": "The Earth link queue",
  "sleep-report": "Last night",
  "radi-exposure": "Radiation this cycle",
  "unknown": "Let me know what to explore",
};

const INTENT_METRICS: Record<Intent, string[]> = {
  "daily-wellness": ["hr-rest", "hrv", "sleep-duration", "co2"],
  "why-tired": ["hrv", "sleep-duration", "sleep-awakenings", "exercise-adherence", "co2"],
  "recovery-deviation": ["hrv", "sleep-duration", "sleep-awakenings", "exercise-adherence"],
  "evidence": ["hrv", "sleep-duration", "hr-rest", "spo2"],
  "exercise-guidance": ["exercise-adherence", "exercise-hr-load", "musculoskeletal-leg"],
  "medical-decision": ["musculoskeletal-leg", "hrv", "exercise-adherence"],
  "emergency": ["hr-rest", "spo2", "hrv"],
  "eva-monitoring": ["exercise-hr-load", "spo2", "hr-rest"],
  "earth-consult": ["hrv", "exercise-adherence", "sleep-duration"],
  "sleep-report": ["sleep-duration", "sleep-awakenings", "hrv"],
  "radi-exposure": ["radiation", "co2"],
  "unknown": ["hrv", "sleep-duration"],
};

function entityFrom(m: Measurement, index: number, total: number): SceneEntity {
  const spread = Math.PI * 2;
  return {
    kind: "field",
    id: `m-${m.metric}`,
    label: m.label,
    // Digits never enter free text: the renderer reads exact numbers from `measurementRef`.
    detail: m.trend === "falling" ? `Falling versus baseline; source: ${m.source}.`
      : m.trend === "rising" ? `Rising versus baseline; source: ${m.source}.`
      : `In line with baseline; source: ${m.source}.`,
    measurementRef: m.metric,
    angle: (index / Math.max(1, total)) * spread,
  };
}

/** Builds the Core's scene for an intent. All inputs are simulated; output is validated before use. */
export function planScene(intent: Intent): Scene {
  const metrics = INTENT_METRICS[intent] ?? INTENT_METRICS.unknown;
  const measures = metrics.map((metric) => measurement(metric)).filter((m): m is Measurement => Boolean(m));
  const state = INTENT_STATE[intent];
  const worst = measures.reduce((worstScore, m) => Math.max(worstScore, Math.abs(zScore(m))), 0);
  const nodes: SceneEntity[] = measures.map((m, i) => entityFrom(m, i, measures.length));
  const filaments: SceneEntity[] = nodes.slice(1).map((n, i) => ({
    kind: "filament",
    id: `f-${i}`,
    label: undefined,
    detail: undefined,
    angle: undefined,
  }));
  const wantsApproval = intent === "exercise-guidance" || intent === "medical-decision";
  const entities: SceneEntity[] = [
    { kind: "core", id: "core" },
    ...nodes,
    ...filaments,
    {
      kind: "membrane",
      id: "briefing",
      label: INTENT_TITLE[intent],
      detail: worst >= 2 ? "A change is worth exploring." : "Nothing needs you right now.",
    },
  ];
  const scene: Scene = {
    schemaVersion: "1.0",
    id: `scene-${intent}-${Math.floor(Math.random() * 1e6)}`, // never parsed programmatically
    state,
    priority: INTENT_PRIORITY[intent],
    intent,
    title: INTENT_TITLE[intent],
    summary: worst >= 2
      ? "A few measurements drifted from your baseline; explore before acting."
      : "Everything is near your baseline.",
    entities,
    interaction: { voice: true, touch: true, approval: wantsApproval ? "required" : intent === "earth-consult" ? "review" : "none" },
    fallback: "accessibility-panel",
    caveat: SIMULATED_CAVEAT,
    simulated: true,
  };
  const gate = validateScene(scene);
  if (!gate.ok) {
    // A planner bug must not ship an invalid scene; fall back to a minimal, guaranteed-valid preset.
    return {
      schemaVersion: "1.0",
      id: "scene-fallback",
      state: "presence",
      priority: "P5",
      intent: "unknown",
      title: "SKY",
      summary: "The Core is here; ask it anything.",
      entities: [{ kind: "core", id: "core" }],
      interaction: { voice: true, touch: true, approval: "none" },
      fallback: "accessibility-panel",
      caveat: SIMULATED_CAVEAT,
      simulated: true,
    };
  }
  return gate.scene;
}

/** The deterministic safety gate for recommendations (UX.md §13): never auto-approve anything clinical. */
export function approvalGate(intent: Intent, _confidence: "low" | "medium" | "high"): "none" | "review" | "required" {
  switch (intent) {
    case "medical-decision":
    case "exercise-guidance":
      return "required";
    case "earth-consult":
      return "review";
    default:
      return "none";
  }
}
