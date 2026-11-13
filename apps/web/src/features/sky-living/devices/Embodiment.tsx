import { useEffect, useRef, useState } from "react";
import { useLocale } from "~/shared/i18n";
import type { UxState, Scene } from "../model/scene";
import type { DeviceClass } from "../model/devices";
import { SIMULATED_LABEL } from "../model/data";
import { strings } from "./strings";
import styles from "./Embodiment.module.css";

export interface EmbodimentProps {
  state: UxState;
  scene: Scene | null;
  device: DeviceClass;
  onAction: (action: string, payload?: unknown) => void;
  lang?: "en" | "vi";
}

export function Embodiment({ state, scene, device, onAction, lang }: EmbodimentProps) {
  const locale = useLocale();
  const l = (lang ?? locale) as "en" | "vi";
  const s = strings[l];
  const reduced = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // audio device: speechSynthesis
  useEffect(() => {
    if (device !== "audio") return;
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    const u = new SpeechSynthesisUtterance(s.speechText);
    u.lang = l === "vi" ? "vi-VN" : "en-US";
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
    return () => window.speechSynthesis.cancel();
  }, [device, l, s.speechText]);

  const badge = <span className={styles.badge}>{s.simulated}</span>;

  switch (device) {
    case "tablet":
      return (
        <div className={styles.tablet}>
          <div className={styles.core}>Sky</div>
          <div className={styles.briefing}>{scene?.summary ?? ""}</div>
          {badge}
        </div>
      );
    case "workstation":
      return (
        <div className={styles.workstation}>
          <div className={styles.workspace}>
            <div className={styles.row}>Resting heart rate · 62 bpm · {SIMULATED_LABEL}</div>
            <div className={styles.row}>HRV · 32 ms · {SIMULATED_LABEL}</div>
          </div>
          <div className={styles.right}>
            <div className={styles.core}>Sky</div>
            <div className={styles.membrane} />
            {badge}
          </div>
        </div>
      );
    case "command-display":
      return (
        <div className={styles.command}>
          <span className={styles.shared}>{s.shared}</span>
          <div className={styles.field}>{scene?.title ?? ""}</div>
          {badge}
        </div>
      );
    case "watch":
      return (
        <div className={styles.watch}>
          <div className={styles.orb} />
          <div className={styles.instruction}>{scene?.summary ?? ""}</div>
          {badge}
        </div>
      );
    case "ar-headset":
      return (
        <div className={styles.ar}>
          <div className={styles.grid} />
          <div className={styles.orb} />
          <div className={styles.callout}>{scene?.title ?? ""}</div>
          <div className={styles.callout}>{s.trackingSimulated}</div>
          {badge}
        </div>
      );
    case "eva-hud":
      return (
        <div className={styles.eva}>
          <div className={styles.exertion}>{s.highExertion}</div>
          <div className={styles.nonNeg}>{s.nonNegotiable}</div>
          {badge}
        </div>
      );
    case "medical-bay":
      return (
        <div className={styles.medical}>
          <div className={styles.rows}>
            <div className={styles.row}>Resting heart rate · 62 bpm · {SIMULATED_LABEL}</div>
            <div className={styles.row}>HRV · 32 ms · {SIMULATED_LABEL}</div>
          </div>
          <svg className={styles.wave} viewBox="0 0 200 40" preserveAspectRatio="none">
            <path d="M0,20 Q25,5 50,20 T100,20 T150,20 T200,20" fill="none" stroke="currentColor" strokeWidth="1" />
          </svg>
          <div className={styles.controls}>
            <button type="button" onClick={() => onAction("approve")}>{s.approve}</button>
            <button type="button" onClick={() => onAction("defer")}>{s.defer}</button>
            <button type="button" onClick={() => onAction("reject")}>{s.reject}</button>
          </div>
          {badge}
        </div>
      );
    case "sleep-pod":
      return (
        <div className={styles.sleep}>
          <div className={styles.line}>{s.everythingQuiet}</div>
          <div className={styles.hint}>{scene?.summary ?? ""}</div>
          {badge}
        </div>
      );
    case "exercise":
      return (
        <div className={styles.exercise}>
          <div className={styles.ring} />
          <div className={styles.remaining}>{s.waitRemaining}</div>
          <div className={styles.cadence}>{s.cadence}</div>
          {badge}
        </div>
      );
    case "rover":
      return (
        <div className={styles.rover}>
          <div className={styles.row}>{s.highExertion}</div>
          <div className={styles.row}>{scene?.summary ?? ""}</div>
          {badge}
        </div>
      );
    case "earth":
      return (
        <div className={styles.earth}>
          <div className={styles.banner}>{s.delayed}</div>
          <div className={styles.title}>{s.earthControl}</div>
          <ul className={styles.timeline}>
            {s.earthStates.map((st, i) => (
              <li key={i}>{st}</li>
            ))}
          </ul>
          {badge}
        </div>
      );
    case "audio":
      return (
        <div className={styles.audio}>
          <div className={styles.glyph}>♪</div>
          <div className={styles.said}>{s.speechText}</div>
          {badge}
        </div>
      );
    default:
      return <div className={styles.fallback}>{badge}</div>;
  }
}