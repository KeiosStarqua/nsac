// @ts-nocheck
import { useCallback, useEffect, useRef, useState } from "react";
import "./hud-screen.css";
import { useMounted } from "../../shared/hooks/useMounted";
import { useReducedMotion } from "motion/react";
import BlurText from "../../shared/react-bits/BlurText/BlurText";
import LightTunnel from "../../shared/react-bits/LightTunnel/LightTunnel";
import Particles from "../../shared/react-bits/Particles/Particles";
import CountUp from "../../shared/react-bits/CountUp/CountUp";
import DepthText from "../../shared/react-bits/DepthText/DepthText";
import ShinyText from "../../shared/react-bits/ShinyText/ShinyText";
import GradientText from "../../shared/react-bits/GradientText/GradientText";
import VariableProximity from "../../shared/react-bits/VariableProximity/VariableProximity";
import DecryptedText from "../../shared/react-bits/DecryptedText/DecryptedText";
import { useSkyVoice } from "./useSkyVoice";
import { PHASE_TEXT, MIC_ARIA } from "./voiceCopy";
import { SpaceArt } from "./SpaceArt";
import { SkyOrb } from "./SkyOrb";
import { VoiceWaveform } from "./VoiceWaveform";
import { InputSurface } from "./InputSurface";
import { DETAILS, FIXTURE_LABEL, VITAL_DETAILS, VITAL_VALUES } from "./vitals";
import { Link, useNavigate } from "@tanstack/react-router";
import { AstronautPicker, ASTRONAUT_STORAGE_KEY, ASTRONAUTS, findAstronaut, firstName, getAstronauts, listClaims, claimAstronaut, getOrCreateSessionId, takenIdsOf, normalizeAstronautId } from "../astronaut";
import type { ClaimEntry } from "../astronaut";
import { ChatPanel } from "./components/ChatPanel";
import { WatchHud } from "./components/WatchHud";
import { DeviceSwitcher } from "./components/DeviceSwitcher";
import { useWatchViewport } from "../../shared/hooks/useWatchViewport";
import { format, useCopy } from "../../shared/i18n";

const DEFAULT_FOOTER = "Demonstration only · Not medical advice";

interface DetailDialogProps {
  title: string;
  value?: string;
  message: string;
  eyebrow: string;
  footer: string;
  action?: { label: string; onClick: () => void };
}

/**
 * SKY — Astronaut Wellness. React port of the original single-file demo: an original procedural
 * scene, a transparent WebGL orb, local Web Audio microphone analysis, SVG waveform and fixture data.
 * No network, no storage, no medical services. See SKY_UI_COMPONENT_FUNCTIONAL_SPEC.md.
 */
export function SkyScreen({ variant }: { variant: "console" | "watch" }) {
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
  // Console redirect probe: raw `?device=watch`, a stored `nsac.device === "watch"`, or any ≤480px
  // viewport bounces `/` to `/watch` (client-side, replace). SSR never renders the watch here.
  const isSmall = useWatchViewport();
  const navigate = useNavigate();
  const [detail, setDetail] = useState<DetailDialogProps | null>(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [astronautId, setAstronautId] = useState<string | null>(null);
  const [roster, setRoster] = useState(() => [...ASTRONAUTS]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [claims, setClaims] = useState<ClaimEntry[]>([]);
  const [claimsReachable, setClaimsReachable] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const [claimError, setClaimError] = useState(false);
  const sessionIdRef = useRef<string | null>(null);
  const [greeting, setGreeting] = useState("Good morning.");
  const [prompt, setPrompt] = useState("How are you feeling today?");
  const [announcer, setAnnouncer] = useState("");
  const [bg, setBg] = useState("particles");
  useEffect(() => {
    if (!mounted) return;
    try {
      const params = new URLSearchParams(window.location.search);
      const fromUrl = params.get("bg");
      const fromStorage = window.localStorage.getItem("nsac.bg");
      const chosen = fromUrl ?? fromStorage ?? "particles";
      setBg(chosen);
      if (fromUrl) window.localStorage.setItem("nsac.bg", chosen);
    } catch { /* ignore */ }
  }, [mounted]);
  // Device views live at dedicated routes: `/` renders the console, `/watch` the full-screen watch.
  // Legacy entries bounce to `/watch`: a raw `?device=watch` in the URL or a stored `nsac.device
  // === "watch"` from before the split, and any ≤480px viewport (phone is watch-only). The legacy
  // key is dropped either way; `?gen=` is console's own param and does not apply to `/watch`.
  const [legacyWatch, setLegacyWatch] = useState(false);
  useEffect(() => {
    if (variant !== "console" || !mounted) return;
    try {
      const params = new URLSearchParams(window.location.search);
      const stored = window.localStorage.getItem("nsac.device");
      if (params.get("device") === "watch" || stored === "watch") setLegacyWatch(true);
      window.localStorage.removeItem("nsac.device");
    } catch { /* ignore */ }
  }, [variant, mounted]);
  const redirectToWatch = variant === "console" && (isSmall || legacyWatch);
  useEffect(() => {
    if (redirectToWatch) void navigate({ to: "/watch", replace: true });
  }, [redirectToWatch, navigate]);
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

  // Crew claims (ai đã giữ astronaut nào). Backend unreachable → claims tắt, picker chạy y
  // như trước (local pick, không enforce): demo không bao giờ bị chặn vì box lỗi. Unreachable
  // ≠ enforced — chỉ là demo resilience, không phải chế độ bảo mật.
  const refreshClaims = useCallback(async (sid: string) => {
    try {
      const res = await listClaims({ data: { sessionId: sid } });
      setClaims(Array.isArray(res?.claims) ? res.claims : []);
      setClaimsReachable(res?.reachable !== false);
    } catch {
      setClaimsReachable(false);
    }
  }, []);

  useEffect(() => {
    if (!mounted) return;
    const sid = getOrCreateSessionId();
    sessionIdRef.current = sid;
    let alive = true;
    void listClaims({ data: { sessionId: sid } })
      .then((res) => {
        if (!alive) return;
        const list = Array.isArray(res?.claims) ? res.claims : [];
        setClaims(list);
        setClaimsReachable(res?.reachable !== false);
        // Pre-HUD gate: localStorage giữ astronaut mà claims nói đã bị session KHÁC giữ
        // (claim cũ từ session đã wipe) → xóa và mở picker, không khóa khung shell mãi.
        // Claims unreachable → giữ nguyên hành vi cũ (tin localStorage).
        if (res?.reachable) {
          try {
            const stored = window.localStorage.getItem(ASTRONAUT_STORAGE_KEY);
            const normalized = normalizeAstronautId(stored);
            const takenByOther =
              normalized && list.some((c) => !c.mine && c.astronautId === normalized);
            if (normalized && takenByOther) {
              window.localStorage.removeItem(ASTRONAUT_STORAGE_KEY);
              setAstronautId(null);
              setGreeting("Good morning.");
              setPickerOpen(true);
            }
          } catch {
            /* storage unavailable → giữ nguyên */
          }
        }
      })
      .catch(() => {
        if (alive) setClaimsReachable(false);
      });
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

  const persistLocalPick = useCallback((astroId: string) => {
    try { window.localStorage.setItem(ASTRONAUT_STORAGE_KEY, astroId); } catch { /* ignore */ }
  }, []);

  const handleAstronautSelect = useCallback(async (id: string) => {
    const astro = findAstronaut(id, roster);
    if (!astro) return;
    const sid = sessionIdRef.current ?? getOrCreateSessionId();
    sessionIdRef.current = sid;
    setClaiming(true);
    setClaimError(false);
    const localPick = () => {
      persistLocalPick(astro.id);
      setAstronautId(astro.id);
      setGreeting(format(copy.astronaut.greeting, { name: firstName(astro.name) }));
      setPickerOpen(false);
    };
    try {
      const res = await claimAstronaut({ data: { sessionId: sid, astronautId: astro.id } });
      if (res.ok) {
        localPick();
      } else if (res.reason === "taken") {
        // Picker giữ nguyên, báo inline; claims refresh ở finally để card vừa mất hiện "CHOSEN".
        setClaimError(true);
      } else if (res.reason === "unavailable") {
        // Backend không reach được → y như local pick trước đây (không enforce).
        localPick();
      } else {
        // "error" — cùng đường đi như unavailable, nhưng log để debug.
        console.warn("[sky] claim failed: unexpected backend response");
        localPick();
      }
    } catch (err) {
      console.warn("[sky] claim request failed", err);
      localPick();
    } finally {
      setClaiming(false);
      void refreshClaims(sid);
    }
  }, [roster, copy, persistLocalPick, refreshClaims]);

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

  // One live WatchHud element shared by the `/watch` route and the hud-gen ≤480px fallback.
  const watchHud = (
    <WatchHud
      phase={phase}
      hint={hint}
      micDisabled={phase === "requesting_permission"}
      astronautName={selectedAstronaut ? firstName(selectedAstronaut.name) : null}
      onToggleMic={() => void toggle()}
      onSelectCrew={() => {
        setClaimError(false);
        setPickerOpen(true);
      }}
      onVital={(kind) => openDetail({ ...VITAL_DETAILS[kind], footer: DEFAULT_FOOTER })}
      onHealth={() => openDetail({ ...DETAILS.health, footer: DEFAULT_FOOTER })}
    />
  );

  // Detail overlay / chat panel / astronaut picker — always at the root.
  const detailOverlay = detail ? (
    <div className="detail-overlay" role="presentation" onClick={(event) => { if (event.target === event.currentTarget) closeDetail(); }}>
      <section role="dialog" aria-modal="true" aria-labelledby="detailTitle" className="detail-glass" tabIndex={-1} ref={detailRef}>
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
  ) : null;

  const chatPanel = chatOpen ? (
    <ChatPanel astronaut={selectedAstronaut ? { id: selectedAstronaut.id, name: selectedAstronaut.name } : null} onClose={() => setChatOpen(false)} onReply={(t) => { setPrompt(t.length > 160 ? `${t.slice(0, 157)}…` : t); setAnnouncer(t); }} />
  ) : null;

  const picker = mounted && pickerOpen ? (
    <AstronautPicker
      open
      roster={roster}
      initialId={astronautId}
      takenIds={takenIdsOf(claims, astronautId)}
      mineId={astronautId}
      claiming={claiming}
      error={claimError ? copy.astronaut.claimTaken : null}
      onSelect={handleAstronautSelect}
      onClose={astronautId ? () => { setPickerOpen(false); setClaimError(false); } : undefined}
    />
  ) : null;

  const overlays = (
    <>
      {detailOverlay}
      {chatPanel}
      {picker}
    </>
  );

  // Redirecting `/` → `/watch` (legacy device entries or ≤480px): render nothing so the console
  // HUD never flashes under the navigation. SSR always renders the console (effects don't run there).
  if (redirectToWatch) return null;

  return (
    <main className="sky-app" data-phase={phase} aria-label="SKY astronaut wellness overview">
      {bg === "particles" ? (
        <div style={{ position: "absolute", inset: 0, zIndex: 0 }} aria-hidden="true">
          <Particles
            particleColors={["#ffffff", "#78eaff", "#c8aaff", "#5dbafa"]}
            particleCount={220}
            particleSpread={9}
            speed={0.075}
            particleBaseSize={110}
            sizeRandomness={1}
            cameraDistance={22}
            glow={0.6}
            twinkle={0.55}
            depthOfField={0}
            alphaParticles={false}
            connections={false}
            hoverEffect="parallax"
            particleHoverFactor={0.8}
            clickBurst={false}
            drift="none"
            intro={true}
            opacity={0.9}
          />
        </div>
      ) : bg === "light-tunnel" ? (
        <div style={{ position: "absolute", inset: 0, zIndex: 0 }} aria-hidden="true">
          <LightTunnel cableColor="#78eaff" pulseColor="#5dbafa" speed={0.08} tunnelOpacity={0} />
        </div>
      ) : (
        <SpaceArt />
      )}
      <div className="space-vignette" aria-hidden="true" />

      {variant === "watch" ? (
        <>
          {watchHud}
          {/* Floating Console | Watch chip — pinned top-right; hidden ≤480px (phone is watch-only). */}
          <DeviceSwitcher current="watch" className="device-switcher-float" />
        </>
      ) : (
        <>
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
        <div className="sky-header-actions">
        <button className="mission-trigger" type="button" aria-label="Mission information" onClick={() => openDetail({
          ...DETAILS.mission,
          footer: DEFAULT_FOOTER,
          action: {
            label: copy.astronaut.change,
            onClick: () => {
              closeDetail();
              setClaimError(false);
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
        <DeviceSwitcher current="console" />
        <Link
          id="spacecraftLink"
          to="/spacecraft"
          className="spacecraft-link"
          aria-label={copy.hud.spacecraftButtonAria}
        >
          <svg viewBox="0 0 48 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="1.3" y="8" width="13" height="8" rx="1.2" />
            <path d="M5.6 8v8M9.9 8v8" />
            <rect x="33.7" y="8" width="13" height="8" rx="1.2" />
            <path d="M38.1 8v8M42.4 8v8" />
            <rect x="19" y="6" width="10" height="12" rx="1.6" />
            <path d="M24 6V2.6M21.6 2.6h4.8" />
            <circle cx="24" cy="12" r="1.5" />
          </svg>
          <span className="spacecraft-text">{copy.hud.spacecraftButton}</span>
        </Link>
        </div>
      </header>

      {/* Vitals projection */}
      <section className="vitals-projection" aria-label="Sample physiological readings">
        <div className="vitals-shield" aria-hidden="true" />
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
        <div className="conversation-lens" aria-hidden="true"><div className="lens-inner" /></div>
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
        <div className="health-shield" aria-hidden="true" />
        <Link id="hologramButton" to="/body" className="hologram-button" aria-label="View simulated body health details">
          <svg className="human-hologram" viewBox="0 0 130 236" role="img" aria-label="Glowing holographic human silhouette">
            <defs>
              <linearGradient id="bodyFill" x1="0" x2="1"><stop stopColor="#80e9ff" stopOpacity=".16" /><stop offset=".48" stopColor="#e5ffff" stopOpacity=".24" /><stop offset="1" stopColor="#65c9ff" stopOpacity=".12" /></linearGradient>
              <linearGradient id="bodyStroke" x1="0" y1="0" x2=".8" y2="1"><stop stopColor="#d5faff" /><stop offset=".5" stopColor="#67d9ff" /><stop offset="1" stopColor="#71b8ff" /></linearGradient>
              <radialGradient id="chestPulse"><stop stopColor="#ffe0a0" stopOpacity=".9" /><stop offset=".3" stopColor="#ffc27f" stopOpacity=".4" /><stop offset="1" stopColor="#ffbe8f" stopOpacity="0" /></radialGradient>
              <filter id="bodyGlow"><feGaussianBlur stdDeviation="3" /></filter>
            </defs>
            <g className="human-figure">
              <path id="humanShape" d="M66 17c-9 0-13 8-11 18 1 7 3 10 6 12v10c-9 3-20 5-26 13-4 6-7 23-11 43l-7 29c-3 11-1 17 3 18 4 1 6-5 7-13l10-29 5-26-1 39c0 14 1 25 4 37l4 44 2 30c1 6 5 8 9 6l5-43 5-46 6 46 3 43c5 3 9 0 9-7l4-33 3-40 2-39-1-39 6 25 9 29c2 10 5 16 9 13 4-2 3-10 0-19l-8-31c-5-22-6-34-11-39-7-8-17-10-26-13V47c4-4 6-10 6-16 0-10-5-14-15-14Z" fill="url(#bodyFill)" stroke="url(#bodyStroke)" strokeWidth="1.6" strokeLinejoin="round" />
              <path d="M65 57 65 103m-25-11c6 6 16 10 25 9 11 1 21-3 27-9M50 154c8 2 23 2 32 0m-16-51v52" stroke="#a8f7ff" opacity=".4" fill="none" />
              <ellipse cx="66" cy="96" rx="29" ry="38" fill="url(#chestPulse)" className="chest-glow" />
            </g>
            <use href="#humanShape" fill="none" stroke="#a0eeff" strokeWidth="3.5" opacity=".65" filter="url(#bodyGlow)" />
          </svg>
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
        </>
      )}

      {/* Overlays always at the root */}
      {overlays}
      <div className="sr-only" role="status" aria-live="polite">{announcer}</div>
    </main>
  );
}
