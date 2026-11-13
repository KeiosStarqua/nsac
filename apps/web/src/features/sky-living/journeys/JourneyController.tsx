import { useReducer, useState } from "react";
import {
  initialSnapshot,
  transition,
  type SkyStateSnapshot,
} from "../model/state-machine";
import { planScene } from "../model/planner";
import { validateScene } from "../model/scene";
import { SceneRenderer } from "./SceneRenderer";
import { IntentBar, classifyIntent } from "./IntentBar";
import { JourneyPanel } from "./JourneyPanel";
import { AccessibleFallback } from "./AccessibleFallback";
import { strings } from "./strings";
import type { Locale } from "~/shared/i18n/locale";

type Action = { type: "event"; event: Parameters<typeof transition>[1] } | { type: "setScene"; scene: unknown };

function reducer(state: { snap: SkyStateSnapshot; scene: unknown }, action: Action) {
  if (action.type === "event") {
    return { snap: transition(state.snap, action.event), scene: state.scene };
  }
  return { ...state, scene: action.scene };
}

const EARTH_STATES = ["local", "queued", "transmitting", "delivered", "acknowledged"] as const;

interface Props {
  locale: Locale;
  device?: string;
}

export function JourneyController({ locale }: Props) {
  const s = strings[locale];
  const [state, dispatch] = useReducer(reducer, {
    snap: initialSnapshot,
    scene: planScene("daily-wellness"),
  });
  const [processing, setProcessing] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [textMode, setTextMode] = useState(false);
  const [earthStep, setEarthStep] = useState(0);
  const [exerciseReps, setExerciseReps] = useState(5);
  const [exerciseRunning, setExerciseRunning] = useState(false);
  const [lifeConfirm, setLifeConfirm] = useState(0);
  const [evaDismissed, setEvaDismissed] = useState(false);

  const handleIntent = (intentKey: string) => {
    setProcessing(true);
    const intentMap: Record<string, string> = {
      "why-tired": "why-tired",
      "exercise-guidance": "exercise-guidance",
      emergency: "emergency",
      "earth-consult": "earth-consult",
      "sleep-report": "sleep-report",
    };
    const intent = (intentMap[intentKey] ?? "unknown") as any;
    if (intent === "emergency") {
      dispatch({ type: "event", event: { type: "emergency" } });
    } else {
      dispatch({ type: "event", event: { type: "user-ask", intent } });
    }
    const scene = planScene(intent);
    dispatch({ type: "setScene", scene });
    setProcessing(false);
    if (intent === "earth-consult") {
      setEarthStep(0);
      const advance = (i: number) => {
        if (i >= EARTH_STATES.length) return;
        setTimeout(() => {
          setEarthStep(i + 1);
          advance(i + 1);
        }, 2000);
      };
      advance(0);
    }
  };

  const approve = () => {
    dispatch({ type: "event", event: { type: "approved" } });
    setToast(s.recorded);
  };
  const defer = () => {
    dispatch({ type: "event", event: { type: "deferred" } });
    setToast(s.deferred);
  };
  const reject = () => {
    dispatch({ type: "event", event: { type: "rejected" } });
    setToast(s.rejected);
  };

  const gate = validateScene(state.scene);
  const scene = gate.ok ? gate.scene : null;
  const approval = scene?.interaction.approval ?? "none";
  const isEmergency = state.snap.state === "emergency";

  return (
    <div className="journeyController">
      <div className="leftCol">
        <JourneyPanel locale={locale} onPick={handleIntent} />
      </div>
      <div className="centerCol">
        {textMode ? (
          <AccessibleFallback locale={locale} />
        ) : (
          <SceneRenderer scene={state.scene} locale={locale} />
        )}
        {approval !== "none" ? (
          <div className="approvalRow">
            <button onClick={approve}>Approve</button>
            <button onClick={defer}>Defer</button>
            <button onClick={reject}>Reject</button>
          </div>
        ) : null}
        {state.snap.lastIntent === "exercise-guidance" && state.snap.state === "continuity" ? (
          <div className="exercisePanel">
            <svg viewBox="0 0 80 80" className="repRing">
              <circle cx="40" cy="40" r="34" className="ringBg" />
              <circle cx="40" cy="40" r="34" className="ringFg" strokeDasharray={`${(exerciseReps / 5) * 213} 213`} />
            </svg>
            <div>{exerciseReps} {s.repsRemaining}</div>
            <button onClick={() => setExerciseRunning((r) => !r)}>{exerciseRunning ? s.pause : s.start}</button>
            <button onClick={() => { setExerciseReps(0); dispatch({ type: "event", event: { type: "exercise-complete" } }); }}>{s.finish}</button>
          </div>
        ) : null}
        {isEmergency ? (
          <div className="emergencyPanel">
            <button onClick={() => setToast("crew alerted")}>{s.alertCrew}</button>
            <button onClick={() => setLifeConfirm((c) => c + 1)}>
              {s.lifeSupport}
            </button>
            {lifeConfirm >= 2 ? <div>{s.lifeSupportUnchanged}</div> : null}
          </div>
        ) : null}
        {state.snap.lastIntent === "earth-consult" ? (
          <div className="earthPanel">
            <div>{s.queued}</div>
            <div>{s.earthStates[EARTH_STATES[Math.min(earthStep, EARTH_STATES.length - 1)] as keyof typeof s.earthStates]}</div>
            <div className="badge">{s.neverBlocks}</div>
          </div>
        ) : null}
        {!evaDismissed && state.snap.lastIntent === "eva-monitoring" ? (
          <div className="evaPanel">
            <div>{s.exertion}</div>
            <button onClick={() => setEvaDismissed(true)}>{s.dismiss}</button>
          </div>
        ) : null}
      </div>
      <div className="bottomBar">
        <button onClick={() => setTextMode((t) => !t)}>
          {textMode ? s.graphicalToggle : s.textToggle}
        </button>
        <IntentBar locale={locale} processing={processing} onSubmit={(k) => handleIntent(k)} />
      </div>
      {toast ? <div className="toast">{toast}</div> : null}
    </div>
  );
}
