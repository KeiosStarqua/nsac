// @ts-nocheck
import { useCallback, useEffect, useRef, useState } from "react";
import "./hud-screen.css";
import { useMounted } from "../../shared/hooks/useMounted";
import { useReducedMotion } from "motion/react";
import BlurText from "../../shared/react-bits/BlurText/BlurText";
import LightTunnel from "../../shared/react-bits/LightTunnel/LightTunnel";
import CountUp from "../../shared/react-bits/CountUp/CountUp";
import DepthText from "../../shared/react-bits/DepthText/DepthText";
import ShinyText from "../../shared/react-bits/ShinyText/ShinyText";
import GradientText from "../../shared/react-bits/GradientText/GradientText";
import VariableProximity from "../../shared/react-bits/VariableProximity/VariableProximity";
import DecryptedText from "../../shared/react-bits/DecryptedText/DecryptedText";
import { useSkyVoice } from "./useSkyVoice";
import { SpaceArt } from "./SpaceArt";
import { SkyOrb } from "./SkyOrb";
import { VoiceWaveform } from "./VoiceWaveform";
import { InputSurface } from "./InputSurface";
import { DETAILS, FIXTURE_LABEL, VITAL_DETAILS, VITAL_VALUES } from "./vitals";
import { Link } from "@tanstack/react-router";
import { AstronautPicker, ASTRONAUT_STORAGE_KEY, ASTRONAUTS, findAstronaut, firstName, getAstronauts } from "../astronaut";
import { ChatPanel } from "./components/ChatPanel";
import { format, useCopy } from "../../shared/i18n";
import type { VitalKind, VoicePhase } from "./types";

const PHASE_TEXT: Record<VoicePhase, string> = {
  idle: "Just talk to me...",
  requesting_permission: "Requesting microphone access…",
  listening: "Listening… Tap to stop",
  transcribing: "SKY is processing…",
  thinking: "SKY is processing…",
  speaking: "SKY is speaking…",
  offline: "SKY is offline — the UI keeps working",
  error: "Mic unavailable — type instead",
};

const MIC_ARIA: Record<VoicePhase, string> = {
  idle: "Activate microphone",
  requesting_permission: "Requesting microphone permission",
  listening: "Stop microphone capture",
  transcribing: "SKY is processing",
  thinking: "SKY is thinking",
  speaking: "SKY is speaking",
  offline: "Microphone unavailable",
  error: "Microphone unavailable — type instead",
};

interface DetailDialogProps {
  title: string;
  value?: string;
  message: string;
  eyebrow: string;
  footer: string;
  action?: { label: string; onClick: () => void };
}

const DEFAULT_FOOTER = "Demonstration only · Not medical advice";

/**
 * SKY — Astronaut Wellness. React port of the original single-file demo: local motion-design plates
 * plus the WebGL orb, local Web Audio microphone analysis, SVG waveform and fixture data.
 * No network, no storage, no medical services. See SKY_UI_COMPONENT_FUNCTIONAL_SPEC.md.
 */
export function SkyScreen() {
  const copy = useCopy();
  const [hint, setHint] = useState(PHASE_TEXT.idle);
  const mounted = useMounted();
  useEffect(() => {
    if (!mounted) return;
    try {
      const stored = window.localStorage.getItem(ASTRONAUT_STORAGE_KEY);
      const astro = findAstronaut(stored);
      if (astro) {
        setAstronautId(astro.id);
        setGreeting(format(copy.astronaut.greeting, { name: firstName(astro.name) }));
      } else {
        setPickerOpen(true);
      }
    } catch {
      setPickerOpen(true);
    }
  }, [mounted]);
  const reduce = useReducedMotion();
  const fx = mounted && !reduce;
  const [detail, setDetail] = useState<DetailDialogProps | null>(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [astronautId, setAstronautId] = useState<string | null>(null);
  const [roster, setRoster] = useState(() => [...ASTRONAUTS]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [greeting, setGreeting] = useState("Good morning.");
  const [prompt, setPrompt] = useState("How are you feeling today?");
  const [announcer, setAnnouncer] = useState("");
  const [bg, setBg] = useState("light-tunnel");
  useEffect(() => {
    if (!mounted) return;
    try {
      const params = new URLSearchParams(window.location.search);
      const fromUrl = params.get("bg");
      const fromStorage = window.localStorage.getItem("nsac.bg");
      const chosen = fromUrl ?? fromStorage ?? "light-tunnel";
      setBg(chosen);
      if (fromUrl) window.localStorage.setItem("nsac.bg", chosen);
    } catch { /* ignore */ }
  }, [mounted]);
  const detailRef = useRef<HTMLDivElement | null>(null);
  const previousFocus = useRef<Element | null>(null);
  const conversationCopyRef = useRef<HTMLDivElement | null>(null);

  const { phase, energyRef, toggle, readEnergy, stop } = useSkyVoice((next) => setHint(PHASE_TEXT[next]));

  // The backend roster is metadata only: the bundled fixture renders first and stays if the
  // request fails (no network, backend down), so the picker never blocks on it.
  useEffect(() => {
    if (!mounted) return;
    let alive = true;
    void getAstronauts()
      .then((rows) => {
        if (alive && Array.isArray(rows) && rows.length > 0) setRoster(rows);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [mounted]);

  // One rAF loop feeds the waveform; orb/waveform read energyRef directly per frame.
  useEffect(() => {
    if (typeof window === "undefined") return;
    let frame = 0;
    let last = 0;
    let elapsed = 0;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    const tick = (now: number) => {
      frame = requestAnimationFrame(tick);
      if (document.hidden) return;
      if (now - last < 33) return;
      const delta = last ? Math.min((now - last) / 1000, 0.06) : 0.033;
      last = now;
      elapsed += delta;
      readEnergy();
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [readEnergy]);

  const handleAstronautSelect = useCallback((id: string) => {
    const astro = findAstronaut(id, roster);
    if (!astro) return;
    try { window.localStorage.setItem(ASTRONAUT_STORAGE_KEY, astro.id); } catch { /* ignore */ }
    setAstronautId(astro.id);
    setGreeting(format(copy.astronaut.greeting, { name: firstName(astro.name) }));
    setPickerOpen(false);
  }, [roster, copy]);

  const openDetail = useCallback(({ title, value, message, eyebrow = "SIMULATED DATA", footer = DEFAULT_FOOTER }: DetailDialogProps) => {
    previousFocus.current = document.activeElement;
    setDetail({ title, value, message, eyebrow, footer });
    setAnnouncer(title);
  }, []);
  const closeDetail = useCallback(() => {
    setDetail(null);
    (previousFocus.current as HTMLElement | null)?.focus();
  }, []);

  useEffect(() => {
    if (!detail) return;
    detailRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeDetail();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [detail, closeDetail]);

  // chat handled by ChatPanel

  const selectedAstronaut = findAstronaut(astronautId, roster);
  const greetingFor = (astro: typeof selectedAstronaut) =>
    astro ? format(copy.astronaut.greeting, { name: firstName(astro.name) }) : "Good morning.";

  return (
    <main className="sky-app" data-phase={phase} aria-label="SKY astronaut wellness overview">
      {bg === "light-tunnel" ? <div style={{ position: "absolute", inset: 0, zIndex: 0 }} aria-hidden="true"><LightTunnel /></div> : null}
      <SpaceArt />
      <div className="space-vignette" aria-hidden="true" />

      {/* Header */}
      <header className="sky-header">
        <button
          className="brand home-trigger"
          type="button"
          aria-label="Return to SKY overview"
          onClick={() => {
            setDetail(null);
            setChatOpen(false);
            setGreeting(greetingFor(findAstronaut(astronautId, roster)));
            setPrompt("How are you feeling today?");
          }}
        >
          <span className="brand-ring" aria-hidden="true" />
          <span className="brand-copy">
            <span className="brand-name"><DepthText text="S K Y" fontSize="clamp(20px, 2.2vw, 29px)" fontWeight={300} layers={10} depth={0.5} tilt={4} autoOrbit={false} intro={false} shadow={false} depthColor="#6fa8d6" /></span>
            <span className="brand-tagline"><ShinyText color="#9bb0c8" shineColor="#d6f2ff" speed={12} intensity={0.4}>Astronaut Wellness</ShinyText></span>
          </span>
        </button>
        <button className="mission-trigger" type="button" aria-label="Mission information" onClick={() => openDetail({
          ...DETAILS.mission,
          footer: DEFAULT_FOOTER,
          action: {
            label: copy.astronaut.change,
            onClick: () => {
              closeDetail();
              setPickerOpen(true);
            },
          },
        })}>
          <span className="station-icon" aria-hidden="true">
            <svg viewBox="0 0 44 36" fill="none">
              <path d="m18 16 8-2M18 21l8-2M15 8l5 10-5 10M28 6l-5 11 5 11M3 12l11-5 4 6-12 5zM31 14l10-5-3 12-9 4z" stroke="currentColor" strokeWidth="1.5" />
              <path d="M11 8 5 23m31-13-7 17M4 6l7 25m28-24-7 25" stroke="currentColor" strokeWidth="1" />
            </svg>
          </span>
          <span className="mission-text">ISS&nbsp; · &nbsp;Day 170</span>
          <span className="mission-underline" aria-hidden="true" />
        </button>
      </header>

      {/* Vitals projection */}
      <section className="vitals-projection" aria-label="Sample physiological readings">
        <div className="vitals-shield" aria-hidden="true"><img className="plate" src="/sky/motion/shield.png" alt="" /></div>
        <button className="vital" type="button" aria-label="Heart rate, demo value 62 beats per minute" onClick={() => openDetail({ ...VITAL_DETAILS.heartRate, footer: DEFAULT_FOOTER })}>
          <span className="vital-icon" aria-hidden="true">
            <svg viewBox="0 0 56 56" fill="none"><path d="M28 43 15.5 30.7C5.5 20.6 20.3 9.2 28 21c7.7-11.8 22.5-.4 12.5 9.7L28 43Z" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round" /></svg>
          </span>
          <span className="vital-value">{fx ? <CountUp to={VITAL_VALUES.heartRate} trigger="load" duration={1.2} decimals={0} /> : VITAL_VALUES.heartRate} <small>bpm</small></span>
        </button>
        <button className="vital" type="button" aria-label="Respiration, demo value 16 breaths per minute" onClick={() => openDetail({ ...VITAL_DETAILS.respiration, footer: DEFAULT_FOOTER })}>
          <span className="vital-icon" aria-hidden="true">
            <svg viewBox="0 0 56 56" fill="none"><path d="M27.5 13v21m1-18 5-4m-5 12 5-6m-7 1-4-6M24 28c-2-5-3-7-5-6-6 1-11 14-8 21 2 5 10 4 14-1l1-11m5-3c2-5 3-7 5-6 6 1 11 14 8 21-2 5-10 4-14-1l-1-11" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </span>
          <span className="vital-value">{fx ? <CountUp to={VITAL_VALUES.respiration} trigger="load" duration={1.2} decimals={0} /> : VITAL_VALUES.respiration} <small>br/min</small></span>
        </button>
        <button className="vital" type="button" aria-label="Oxygen saturation, demo value 98 percent" onClick={() => openDetail({ ...VITAL_DETAILS.spo2, footer: DEFAULT_FOOTER })}>
          <span className="vital-icon oxygen" aria-hidden="true">O<sub>2</sub></span>
          <span className="vital-value">{fx ? <CountUp to={VITAL_VALUES.spo2} trigger="load" duration={1.2} decimals={0} /> : VITAL_VALUES.spo2} <small>%</small></span>
        </button>
        <button className="vital" type="button" aria-label="Sleep, demo value seven hours and forty-two minutes" onClick={() => openDetail({ ...VITAL_DETAILS.sleep, footer: DEFAULT_FOOTER })}>
          <span className="vital-icon" aria-hidden="true">
            <svg viewBox="0 0 56 56" fill="none"><path d="M39.8 39.2C29.2 45.6 15.5 39 13.6 26.5c-1-7.1 2.4-13.6 8.4-17.4-1.4 13.2 6.4 22.5 19.1 19-1.1 4.8-5 8.5-1.3 11.1Z" stroke="currentColor" strokeWidth="2.4" strokeLinejoin="round" /></svg>
          </span>
          <span className="vital-value">{fx ? <CountUp to={VITAL_VALUES.sleepHours} trigger="load" duration={1.2} decimals={0} /> : VITAL_VALUES.sleepHours} <small>h</small> {fx ? <CountUp to={VITAL_VALUES.sleepMinutes} trigger="load" duration={1.2} decimals={0} /> : VITAL_VALUES.sleepMinutes} <small>m</small></span>
        </button>
        <span className="demo-indicator">{fx ? <DecryptedText text={FIXTURE_LABEL} animateOn="view" loop={false} speed={50} /> : FIXTURE_LABEL}</span>
      </section>

      {/* Conversation */}
      <section className="conversation" aria-label="SKY conversation">
        <div className="conversation-lens" aria-hidden="true"><img className="plate lens-plate" src="/sky/motion/lens.png" alt="" /><div className="lens-inner" /></div>
        <div className="orb-zone" aria-hidden="true"><div className="orb-css-fallback" /><SkyOrb phase={phase} energyRef={energyRef} /></div>
        <div className="conversation-copy" ref={conversationCopyRef}>
          <h1 id="greeting">{fx ? <BlurText text={greeting} animationFrom={{filter:"blur(10px)",opacity:0}} animationTo={[{filter:"blur(0px)",opacity:1}]} color="#ecf7ff" easing="easeOut" /> : greeting}</h1>
          <p id="prompt"><VariableProximity label={prompt} containerRef={conversationCopyRef} radius={60} /></p>
        </div>
        <VoiceWaveform phase={phase} energyRef={energyRef} />
        <p id="captions" className="captions" aria-live="polite">
          {phase === "listening" ? "Microphone active · audio analysed locally" : phase === "error" ? "Microphone unavailable — type instead" : ""}
        </p>
      </section>

      {/* Health projection */}
      <section className="health-projection" aria-label="Health summary, simulated data">
        <div className="health-shield" aria-hidden="true"><img className="plate shield-mirror" src="/sky/motion/shield.png" alt="" /></div>
        <Link id="hologramButton" to="/body" className="hologram-button" aria-label="View simulated body health details">
          <img className="holo-plate" src="/sky/motion/holo.png" alt="" />
        </Link>
        <button type="button" id="healthButton" className="health-summary" aria-label="View simulated overall health assessment" onClick={() => openDetail({ ...DETAILS.health, footer: DEFAULT_FOOTER })}>
          <span className="health-label">Overall</span>
          <strong><GradientText colors={["#7fe9c9","#5ee6ff","#7fe9c9"]} animationSpeed={3} pointerEvents="none">Stable</GradientText></strong>
          <span className="health-guidance">Maintain recovery<br />and readiness</span>
          <span className="health-demo">{fx ? <DecryptedText text="DEMO STATUS" animateOn="view" loop={false} speed={50} /> : "DEMO STATUS"}</span>
        </button>
      </section>

      {/* Fluid surface + mic */}
      <InputSurface />
      <div className="voice-control">
        <button id="micButton" className="mic-button" type="button" aria-label={MIC_ARIA[phase]} disabled={phase === "requesting_permission"} onClick={() => void toggle()}>
          <svg viewBox="0 0 48 48" aria-hidden="true"><rect x="18" y="8" width="12" height="24" rx="6" fill="none" stroke="currentColor" strokeWidth="2.4" /><path d="M13 24c0 15 22 15 22 0M24 36v6m-7 0h14" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" /></svg>
        </button>
        <div id="voiceHint" className="voice-hint" aria-live="polite">{hint}</div>
        <button type="button" className="text-trigger" id="textButton" aria-label="Type a message to SKY" onClick={() => setChatOpen(true)}>Type instead</button>
      </div>

      {/* Detail overlay */}
      {detail ? (
        <div className="detail-overlay" role="presentation" onClick={(event) => { if (event.target === event.currentTarget) closeDetail(); }}>
          <section role="dialog" aria-modal="true" aria-labelledby="detailTitle" className="detail-glass" tabIndex={-1} ref={detailRef}>
            <img className="glass-plate" src="/sky/motion/glass.png" alt="" />
            <button type="button" id="detailClose" className="detail-close" aria-label="Close details" onClick={closeDetail}>×</button>
            <div id="detailEyebrow" className="detail-eyebrow">{detail.eyebrow}</div>
            <h2 id="detailTitle">{detail.title}</h2>
            {detail.value ? <p id="detailValue" className="detail-value">{detail.value}</p> : null}
            <p id="detailMessage" className="detail-message">{detail.message}</p>
            {detail.action ? (
              <button type="button" className="detail-action" onClick={detail.action.onClick}>{detail.action.label}</button>
            ) : null}
            <p id="detailFooter" className="detail-footer">{detail.footer}</p>
          </section>
        </div>
      ) : null}

      {/* Text chat */}
      {chatOpen ? (
        <ChatPanel astronaut={selectedAstronaut ? { id: selectedAstronaut.id, name: selectedAstronaut.name } : null} onClose={() => setChatOpen(false)} onReply={(t) => setPrompt(t)} />
      ) : null}

      {mounted && pickerOpen ? (
        <AstronautPicker
          open
          roster={roster}
          initialId={astronautId}
          onSelect={handleAstronautSelect}
          onClose={astronautId ? () => setPickerOpen(false) : undefined}
        />
      ) : null}
      <div className="sr-only" role="status" aria-live="polite">{announcer}</div>
    </main>
  );
}
