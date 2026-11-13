import { useCallback, useEffect, useReducer, useState } from "react";
import { measurement } from "./model/data";
import { initialSnapshot, transition, type SkyStateSnapshot } from "./model/state-machine";
import { planScene } from "./model/planner";
import type { DeviceClass } from "./model/devices";
import type { Intent, Scene, UxState } from "./model/scene";
import { CoreField } from "./core";
import { DeviceSwitcher, Embodiment } from "./devices";
import { AccessibleFallback, IntentBar, JourneyPanel, strings } from "./journeys";
import type { Locale } from "~/shared/i18n/locale";
import "./core/tokens.css";
import styles from "./SkyLiving.module.css";

/**
 * The SKY living interface (UX.md): presence, attention, understanding, decision, continuity,
 * connection, emergency — one Living Core, simulated mission data, every action gated by the crew.
 * `tablet` is the full interactive experience; the other classes render the same state as device
 * projections (developer simulation, top-right switcher).
 */

type StageAction = { type: "event"; event: Parameters<typeof transition>[1] } | { type: "setScene"; scene: Scene };
interface StageState {
  readonly snap: SkyStateSnapshot;
  readonly scene: Scene;
}

function reduce(
  state: StageState,
  action: StageAction,
): StageState {
  switch (action.type) {
    case "event":
      return { ...state, snap: transition(state.snap, action.event) };
    case "setScene":
      return { ...state, scene: action.scene };
  }
}

const EARTH_STATES = ["local", "queued", "transmitting", "delivered", "acknowledged"] as const;
type EarthStep = (typeof EARTH_STATES)[number];

const INTENT_BY_KEY: Record<string, Intent> = {
  wellness: "daily-wellness",
  "why-tired": "why-tired",
  recovery: "recovery-deviation",
  evidence: "evidence",
  exercise: "exercise-guidance",
  emergency: "emergency",
  eva: "eva-monitoring",
  earth: "earth-consult",
  "sleep-report": "sleep-report",
  "unknown": "unknown",
};

export function SkyLivingExperience({ locale }: { locale: Locale }) {
  const s = strings[locale];
  const [device, setDevice] = useState<DeviceClass>("tablet");
  const [stage, dispatch] = useReducer(reduce, {
    snap: initialSnapshot,
    scene: planScene("daily-wellness"),
  });
  const [textMode, setTextMode] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [decidedFor, setDecidedFor] = useState<string | null>(null);
  const [earthStep, setEarthStep] = useState<EarthStep>("local");
  const [repsLeft, setRepsLeft] = useState(5);
  const [exerciseRunning, setExerciseRunning] = useState(false);
  const [lifeConfirm, setLifeConfirm] = useState(0);
  const [evaDismissed, setEvaDismissed] = useState(false);

  // Auto-advance the simulated Earth uplink (UX.md: queued until acknowledged; never real-time).
  useEffect(() => {
    if (stage.snap.lastIntent !== "earth-consult") return;
    if (earthStep === "acknowledged") return;
    const order: EarthStep[] = ["local", "queued", "transmitting", "delivered", "acknowledged"];
    const i = order.indexOf(earthStep);
    const timer = setTimeout(() => { const next = order[i + 1]; if (next) setEarthStep(next); }, 2500);
    return () => clearTimeout(timer);
  }, [earthStep, stage.snap.lastIntent]);

  // Exercise pacing: one rep every 1.2 s while running.
  useEffect(() => {
    if (!exerciseRunning || repsLeft <= 0) return;
    const timer = setInterval(() => setRepsLeft((n) => Math.max(0, n - 1)), 1_200);
    return () => clearInterval(timer);
  }, [exerciseRunning, repsLeft]);
  useEffect(() => {
    if (repsLeft === 0 && stage.snap.lastIntent === "exercise-guidance" && stage.snap.state === "continuity") {
      setExerciseRunning(false);
      dispatch({ type: "event", event: { type: "exercise-complete" } });
      setToast(s.exerciseDone);
    }
  }, [repsLeft, stage.snap, s.recorded, s.exerciseDone]);

  const ask = useCallback(
    (key: string) => {
      const intent = INTENT_BY_KEY[key] ?? "unknown";
      dispatch(intent === "emergency"
        ? { type: "event", event: { type: "emergency" } }
        : { type: "event", event: { type: "user-ask", intent } });
      dispatch({ type: "setScene", scene: planScene(intent) });
      if (intent === "earth-consult") setEarthStep("local");
      if (intent === "exercise-guidance") {
        setRepsLeft(5);
        setExerciseRunning(false);
      }
      setEvaDismissed(false);
      setDecidedFor(null);
      setLifeConfirm(0);
    },
    [],
  );

  const decide = (verdict: "approved" | "deferred" | "rejected") => {
    dispatch({ type: "event", event: { type: verdict } });
    setDecidedFor(stage.scene.id);
    setToast(verdict === "approved" ? s.recorded : verdict === "deferred" ? s.deferred : s.rejected);
  };

  const nodes = stage.scene.entities
    .filter((e) => e.kind === "field" && e.measurementRef)
    .map((e, i) => ({ id: e.id, angle: e.angle ?? (i * Math.PI * 2) / Math.max(1, stage.scene.entities.length), measurementRef: e.measurementRef as string }));
  const points = nodes.map((n) => ({
    id: n.id,
    angle: n.angle,
    quality: measurement(n.measurementRef)?.quality ?? "unknown",
  }));

  const isEmergency = stage.snap.state === "emergency";
  const needsApproval = stage.scene.interaction.approval !== "none" && decidedFor !== stage.scene.id && !isEmergency;
  const showExercise = stage.snap.lastIntent === "exercise-guidance" && stage.snap.state === "continuity";
  const showEarth = stage.snap.lastIntent === "earth-consult";
  const showEva = stage.snap.lastIntent === "eva-monitoring" && !evaDismissed;

  if (device !== "tablet") {
    return (
      <section className={styles.root} aria-label="SKY">
        <div className={styles.title}>
          <h1>SKY</h1>
          <p>{s.subtitle}</p>
        </div>
        <DeviceSwitcher device={device} onChange={(d) => setDevice(d as DeviceClass)} />
        <Embodiment
          device={device}
          state={stage.snap.state}
          scene={stage.scene}
          onAction={(action) => {
            if (action === "approve") decide("approved");
            else if (action === "defer") decide("deferred");
            else if (action === "reject") decide("rejected");
          }}
        />
        <p className={styles.simulated}>{s.simulatedData}</p>
      </section>
    );
  }

  return (
    <section className={styles.root} aria-label="SKY">
      <div className={styles.title}>
        <h1>SKY</h1>
        <p>{s.subtitle}</p>
        <span className={styles.simulated}>{s.simulatedData}</span>
      </div>
      <DeviceSwitcher device={device} onChange={(d) => setDevice(d as DeviceClass)} />
      <div className={styles.stage}>
        <JourneyPanel locale={locale} onPick={ask} />
        <div className={styles.coreCol}>
          {textMode ? (
            <AccessibleFallback locale={locale} />
          ) : (
            <CoreField
              className={styles.field}
              state={stage.snap.state}
              density="medium"
              points={points}
              nodes={nodes}
              onSelect={(ref) => {
                const m = measurement(ref);
                if (m) setToast(`${m.label}: ${m.display}`);
              }}
            />
          )}
          {needsApproval ? (
            <div className={styles.membrane} role="dialog" aria-label={s.decisionTitle}>
              <h2>{s.decisionTitle}</h2>
              <p>{stage.scene.summary}</p>
              <p className={styles.membraneCaveat}>{stage.scene.caveat}</p>
              <div className={styles.approvalRow}>
                <button type="button" className={styles.approve} onClick={() => decide("approved")}>{s.approve}</button>
                <button type="button" className={styles.defer} onClick={() => decide("deferred")}>{s.defer}</button>
                <button type="button" className={styles.reject} onClick={() => decide("rejected")}>{s.reject}</button>
              </div>
            </div>
          ) : null}
          {isEmergency ? (
            <div className={styles.emergency} role="alert">
              <h2>{s.emergencyTitle}</h2>
              <p>{s.emergencyBody}</p>
              <div className={styles.approvalRow}>
                <button type="button" onClick={() => setToast(s.crewAlerted)}>{s.alertCrew}</button>
                <button
                  type="button"
                  className={styles.lifeSupport}
                  onClick={() => setLifeConfirm((n) => Math.min(2, n + 1))}
                >
                  {lifeConfirm >= 2 ? s.lifeConfirmed : lifeConfirm === 1 ? s.holdAgain : s.lifeSupport}
                </button>
              </div>
              <p className={styles.membraneCaveat}>{s.lifeSupportUnchanged}</p>
            </div>
          ) : null}
          {showExercise ? (
            <div className={styles.exercise} aria-live="polite">
              <svg viewBox="0 0 80 80" className={styles.repRing} role="img" aria-label={`${repsLeft} ${s.repsRemaining}`}>
                <circle cx="40" cy="40" r="34" className={styles.ringBg} />
                <circle cx="40" cy="40" r="34" className={styles.ringFg} strokeDasharray={`${(repsLeft / 5) * 213} 213`} />
              </svg>
              <span className={styles.repCount}>{repsLeft}</span>
              <button type="button" onClick={() => setExerciseRunning((v) => !v)}>
                {exerciseRunning ? s.pause : s.start}
              </button>
              <button type="button" onClick={() => { setRepsLeft(0); dispatch({ type: "event", event: { type: "exercise-complete" } }); setToast(s.exerciseDone); }}>
                {s.finish}
              </button>
            </div>
          ) : null}
          {showEarth ? (
            <div className={styles.earth} aria-live="polite">
              <p className={styles.earthTitle}>{s.queued}</p>
              <ol className={styles.earthTimeline}>
                {(["local", "queued", "transmitting", "delivered", "acknowledged"] as const).map((step) => (
                  <li key={step} data-state={s.earthStates[step]} className={EARTH_STATES.indexOf(step) <= EARTH_STATES.indexOf(earthStep) ? styles.done : undefined}>
                    {s.earthStates[step]}
                  </li>
                ))}
              </ol>
              <p className={styles.membraneCaveat}>{s.neverBlocks}</p>
            </div>
          ) : null}
          {showEva ? (
            <div className={styles.eva}>
              <p>{s.exertion}</p>
              <button type="button" onClick={() => setEvaDismissed(true)}>{s.dismiss}</button>
            </div>
          ) : null}
        </div>
      </div>
      <div className={styles.bottomBar}>
        <button type="button" className={styles.textToggle} onClick={() => setTextMode((v) => !v)}>
          {textMode ? s.graphicalToggle : s.textToggle}
        </button>
        <IntentBar locale={locale} processing={false} onSubmit={(intent) => ask(intent)} />
      </div>
      {toast ? <div className={styles.toast} role="status">{toast}</div> : null}
    </section>
  );
}
