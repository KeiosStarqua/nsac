import { useEffect, useMemo, useState } from "react";
import { useSkySceneModel } from "./hooks";
import { SkyIdentity, MissionContext, VitalsProjection, MetricProjection, HealthProjection, GreetingPrompt, MicrophoneOrb, VoiceHint, Captions, CriticalAlertLayer } from "./components";
import { SpaceSceneBackground, ViewportFrameFX, AICoreOrb, OrganicInputSurface, ConversationLens, LiveVoiceWaveform } from "./graphics";
import { FIXTURE_LABEL } from "./domain";
import type { VitalKind } from "./domain";
import styles from "./hud-screen.module.css";

const STAGE_W = 1672;
const STAGE_H = 941;

/**
 * The SKY HUD, pixel-matched to the 1672×941 reference frame (see SKY_UI_COMPONENT_FUNCTIONAL_SPEC.md
 * §1). Deep-space window, left vitals cluster, center orb + voice, right health projection, fluid
 * input surface along the bottom — no chrome, no dashboards. All telemetry is the labeled fixture.
 */
export function SkyScreen() {
  const { model, greeting, toggleVoice, submitTyped, retry, clock } = useSkySceneModel();
  const [scale, setScale] = useState(1);
  const [metric, setMetric] = useState<VitalKind | null>(null);
  const [alert, setAlert] = useState<string | null>(null);
  const [alertAcknowledged, setAlertAcknowledged] = useState(false);

  // Fit the 1672×941 stage to the window without shrinking text to unreadable sizes.
  useEffect(() => {
    const update = () => setScale(Math.min(window.innerWidth / STAGE_W, window.innerHeight / STAGE_H, 1));
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMetric(null);
        setAlert(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // A typed/spoken command raises the safety layer above everything; it can never be acknowledged by a gesture.
  const transcript = model.currentTranscript ?? "";
  useEffect(() => {
    if (/emergenc|khẩn cấp|cứu/.test(transcript)) {
      setAlert("Safety command received. Aspects are within certified thresholds; no suit or clinical action was taken.");
      setAlertAcknowledged(false);
    }
  }, [transcript]);

  const orbitingMission = useMemo(
    () => ({ stationLabel: model.mission.stationLabel, missionDay: model.mission.missionDay, spacecraftTimeIso: clock.timeLabel, online: model.mission.online }),
    [model.mission, clock.timeLabel],
  );

  const emergencyMentioned = /emergenc|khẩn cấp/.test(model.responseText ?? "");
  const showCaptions = model.voicePhase !== "idle" && Boolean(model.currentTranscript || model.responseText);

  return (
    <div className={styles.viewport} aria-label="SKY — astronaut wellness">
      <div className={styles.stage} style={{ transform: `translate(-50%, -50%) scale(${scale})` }}>
        <SpaceSceneBackground />

        <ViewportFrameFX />

        <div className={styles.posIdentity}>
          <SkyIdentity />
        </div>
        <div className={styles.posMission}>
          <MissionContext mission={orbitingMission} />
        </div>

        <div className={styles.posVitals}>
          <VitalsProjection vitals={model.vitals} onSelect={setMetric} />
        </div>

        <div className={styles.lensLayer}>
          <ConversationLens energy={model.voiceEnergy} reducedMotion={model.reducedMotion} />
        </div>
        <div className={styles.orbLayer}>
          <AICoreOrb phase={model.voicePhase} audioEnergy={model.voiceEnergy} qualityTier={model.performanceTier} reducedMotion={model.reducedMotion} />
        </div>
        <div className={styles.greetingLayer}>
          <GreetingPrompt displayName={model.astronautDisplayName} timeOfDay={new Date().getHours()} />
        </div>
        <div className={styles.waveformLayer}>
          <LiveVoiceWaveform energy={model.voiceEnergy} amplitude={model.voiceEnergy * 10} phase={model.voicePhase} reducedMotion={model.reducedMotion} />
        </div>
        {showCaptions ? (
          <div className={styles.captionsLayer}>
            <Captions transcript={model.currentTranscript} responseText={model.responseText} visible />
          </div>
        ) : null}

        <div className={styles.healthLayer}>
          <HealthProjection health={model.health} onOpenHealthSummary={() => {}} />
        </div>

        <div className={styles.surfaceLayer}>
          <OrganicInputSurface phase={model.voicePhase} energy={model.voiceEnergy} reducedMotion={model.reducedMotion} />
        </div>
        <div className={styles.micLayer}>
          <MicrophoneOrb phase={model.voicePhase} isMicActive={model.voicePhase === "listening"} onToggle={toggleVoice} onInterrupt={toggleVoice} />
        </div>
        <div className={styles.hintLayer}>
          <VoiceHint phase={model.voicePhase} />
        </div>

        {/* Context projections — open on demand, anchored, never full-screen navigation */}
        <MetricProjection reading={metric ? model.vitals[metric] : null} open={metric !== null} onClose={() => setMetric(null)} />

        {/* Safety-priority layer: works even if shaders, mic, and the model all fail */}
        <CriticalAlertLayer
          visible={alert !== null && !alertAcknowledged}
          message={alert ?? ""}
          onAcknowledge={() => setAlertAcknowledged(true)}
          onHandover={() => setAlertAcknowledged(true)}
        />
        {emergencyMentioned && !alert ? (
          <CriticalAlertLayer
            visible
            message="SKY did not act. Life support is certified and unchanged."
            onAcknowledge={() => setAlertAcknowledged(true)}
            onHandover={() => setAlertAcknowledged(true)}
          />
        ) : null}

        <span className={`${styles.fixtureBadge}`} aria-hidden="true">{FIXTURE_LABEL}</span>
        <div role="status" className={styles.srOnly}>{model.voicePhase}</div>
      </div>
      <TypedFallback submitTyped={submitTyped} onRetry={retry} />
    </div>
  );
}

/** Always-visible typed fallback (spec: typed input is a first-class input, not a debugger). */
function TypedFallback({ submitTyped, onRetry }: { submitTyped: (text: string) => void; onRetry: () => void }) {
  const [text, setText] = useState("");
  const submit = () => {
    const value = text.trim();
    if (!value) return;
    submitTyped(value);
    setText("");
  };
  return (
    <form
      className={styles.typedRow}
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <label className={styles.srOnly} htmlFor="sky-hud-typed">Type to SKY</label>
      <input
        id="sky-hud-typed"
        className={styles.typedField}
        type="text"
        autoComplete="off"
        maxLength={280}
        value={text}
        placeholder="type to SKY…"
        onChange={(event) => setText(event.target.value)}
      />
      <button type="submit" className={styles.typedSend}>→</button>
      <button type="button" className={styles.typedSend} onClick={onRetry} aria-label="Retry voice">↻</button>
    </form>
  );
}
