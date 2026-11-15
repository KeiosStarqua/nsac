// @ts-nocheck
import { useCallback, useEffect, useRef, useState } from "react";
import { useMounted } from "../../shared/hooks/useMounted";
import { useReducedMotion } from "motion/react";
import BlurText from "../../shared/react-bits/BlurText/BlurText";
import Galaxy from "../../shared/react-bits/Galaxy/Galaxy";
import Particles from "../../shared/react-bits/Particles/Particles";
import Topography from "../../shared/react-bits/Topography/Topography";
import CountUp from "../../shared/react-bits/CountUp/CountUp";
import DepthText from "../../shared/react-bits/DepthText/DepthText";
import ShinyText from "../../shared/react-bits/ShinyText/ShinyText";
import GradientText from "../../shared/react-bits/GradientText/GradientText";
import VariableProximity from "../../shared/react-bits/VariableProximity/VariableProximity";
import DecryptedText from "../../shared/react-bits/DecryptedText/DecryptedText";
import VoicePill from "../../shared/react-bits/VoicePill/VoicePill";
import {
  BRAND, BRAND_COPY, BRAND_NAME, BRAND_RING, BRAND_TAGLINE, CAPTIONS, CONVERSATION,
  CONVERSATION_COPY, DEMO_INDICATOR, DETAIL_ACTION,
  DETAIL_CLOSE, DETAIL_EYEBROW, DETAIL_FOOTER, DETAIL_GLASS, DETAIL_MESSAGE, DETAIL_OVERLAY,
  DETAIL_VALUE, DEVICE_SWITCHER_FLOAT, HEALTH_DEMO, HEALTH_GUIDANCE, HEALTH_LABEL, HEALTH_PROJECTION,
  HEALTH_SHIELD, HEALTH_STATUS, HEALTH_SUMMARY, HOLOGRAM_LINK, MISSION_TEXT,
  MISSION_TRIGGER, MISSION_UNDERLINE, ORB_ZONE, ORB_ZONE_THINKING, SKY_APP, SKY_HEADER,
  SKY_HEADER_ACTIONS, SPACE_VIGNETTE, SPACECRAFT_LINK, STATION_ICON, VITAL_ICON,
  VITAL_ICON_OXYGEN, VITAL_TILE, VITAL_VALUE, VITALS_PROJECTION, VITALS_SHIELD, VOICE_CLUSTER,
  VOICE_CLUSTER_DIMMED, VOICE_CONTROL, VOICE_HINT, VOICE_SIGNAL, WATCH_CAPTION, WATCH_DEVICE,
  WATCH_FRAME, WATCH_SCREEN, WATCH_STAGE,
} from "./hud-classes";
import { useSkyVoice } from "./useSkyVoice";
import { agentStateForVoicePhase } from "./agent-state";
import { useToggleChatShortcut } from "./useToggleChatShortcut";
import { PHASE_TEXT, MIC_ARIA } from "./voiceCopy";
import { SkyOrb } from "./SkyOrb";
import { VoiceWaveform } from "./VoiceWaveform";
import { DETAILS, FIXTURE_LABEL, VITAL_DETAILS, VITAL_VALUES } from "./vitals";
import { Link, useNavigate } from "@tanstack/react-router";
import { AstronautPicker, ASTRONAUT_STORAGE_KEY, ASTRONAUTS, findAstronaut, firstName, getAstronauts, listClaims, claimAstronaut, releaseAllClaims, getOrCreateSessionId, takenIdsOf, normalizeAstronautId, useClaimHeartbeat, useClaimsWatcher, CLAIMS_EPOCH_STORAGE_KEY } from "../astronaut";
import type { ClaimEntry } from "../astronaut";
import { ChatPanel } from "./components/ChatPanel";
import { SkyChatPanel } from "./components/SkyChatPanel";
import { ListeningBar, TypeInsteadPill } from "./components";
import { WatchHud } from "./components/WatchHud";
import { DeviceSwitcher } from "./components/DeviceSwitcher";
import { HologramBody, HoloCredit } from "./components";
import { useWatchViewport } from "../../shared/hooks/useWatchViewport";
import { format, useCopy } from "../../shared/i18n";
import { useHudBackground } from "../hud-bg";

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
  // Admin-configured console backdrop (`/admin/background`); particles is the default. The
  // `?bg=` / `nsac.bg` precedence is retired — admin always wins.
  const bg = useHudBackground();
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

  const { phase, energyRef, toggle, readEnergy, readSpectrum, stop } = useSkyVoice((next) => setHint(PHASE_TEXT[next]));
  const orbState = agentStateForVoicePhase(phase);

  // ⌘K / Ctrl+K toggles the chat card on the console; `/watch` keeps the legacy in-face panel.
  useToggleChatShortcut(() => setChatOpen((open) => !open), variant !== "watch");

  // Claim TTL: đập heartbeat mỗi 30 s khi tab visible để claim không bị backend giải phóng sau
  // 30 phút idle (no-op khi SSR).
  useClaimHeartbeat();

  // Force release ở tab khác: backend bump epoch → tab đang mở cũng bỏ pick của mình (poll 45 s,
  // chỉ khi tab visible). Console only — `/watch` không wire watcher này.
  useClaimsWatcher(
    () => {
      try {
        window.localStorage.removeItem(ASTRONAUT_STORAGE_KEY);
      } catch {
        /* storage unavailable → vẫn kick */
      }
      setAstronautId(null);
      setGreeting("Good morning.");
      setPickerOpen(true);
    },
    variant === "console",
  );

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
          const epoch = typeof res.epoch === "number" ? res.epoch : null;
          let storedEpoch: string | null = null;
          try {
            storedEpoch = window.localStorage.getItem(CLAIMS_EPOCH_STORAGE_KEY);
          } catch {
            storedEpoch = null;
          }
          // Force release ở nơi khác (epoch backend đã bump): bỏ pick local và về picker, KHÔNG
          // re-claim — người bấm force release muốn mọi người chọn lại từ đầu.
          if (epoch !== null && storedEpoch !== null && storedEpoch !== String(epoch)) {
            try {
              window.localStorage.setItem(CLAIMS_EPOCH_STORAGE_KEY, String(epoch));
            } catch {
              /* storage unavailable → vẫn kick */
            }
            try {
              window.localStorage.removeItem(ASTRONAUT_STORAGE_KEY);
            } catch {
              /* storage unavailable → vẫn kick */
            }
            setAstronautId(null);
            setGreeting("Good morning.");
            setPickerOpen(true);
            return;
          }
          if (epoch !== null && storedEpoch === null) {
            // Lần đầu thấy epoch → chỉ ghi nhận, không kick.
            try {
              window.localStorage.setItem(CLAIMS_EPOCH_STORAGE_KEY, String(epoch));
            } catch {
              /* ignore */
            }
          }
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
            } else if (normalized) {
              // Quay lại sau một thời gian idle: claim cũ có thể đã bị TTL giải phóng. Còn trống
              // → claim lại im lặng (không mở picker, không đổi gì trên HUD); thua race với
              // session khác → cùng đường đi như takenByOther.
              void claimAstronaut({ data: { sessionId: sid, astronautId: normalized } })
                .then((claimed) => {
                  if (!alive || claimed.ok) {
                    // Claim lại thành công → card trong picker chuyển sang "của mình" ngay,
                    // không phải chờ lần refresh sau.
                    if (claimed.ok) {
                      setClaims((prev) =>
                        prev.map((c) =>
                          c.astronautId === normalized ? { ...c, mine: true } : c,
                        ),
                      );
                    }
                    return;
                  }
                  if (claimed.reason !== "taken") return; // unavailable/error → giữ nguyên
                  try {
                    window.localStorage.removeItem(ASTRONAUT_STORAGE_KEY);
                    setAstronautId(null);
                    setGreeting("Good morning.");
                    setPickerOpen(true);
                  } catch {
                    /* storage unavailable → giữ nguyên */
                  }
                })
                .catch(() => {
                  /* giữ nguyên pick local */
                });
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

  /**
   * Force release (picker escape hatch): gỡ mọi claim rồi làm mới danh sách. Pick của chính mình
   * cũng bị gỡ — epoch vừa bump nên ghi luôn epoch mới vào localStorage để mount gate/watcher
   * không kick thêm lần nữa; picker vẫn mở (người dùng đang ở đó) để chọn lại.
   */
  const handleForceRelease = useCallback(async () => {
    const res = await releaseAllClaims();
    if (res.ok) {
      if (typeof res.epoch === "number") {
        try {
          window.localStorage.setItem(CLAIMS_EPOCH_STORAGE_KEY, String(res.epoch));
        } catch {
          /* ignore */
        }
      }
      try {
        window.localStorage.removeItem(ASTRONAUT_STORAGE_KEY);
      } catch {
        /* ignore */
      }
      setAstronautId(null);
      setGreeting("Good morning.");
      const sid = sessionIdRef.current ?? getOrCreateSessionId();
      sessionIdRef.current = sid;
      await refreshClaims(sid);
    }
    return res;
  }, [refreshClaims]);

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

  // Detail overlay / chat panel / astronaut picker — rendered inside `.watch-screen` in the framed
  // `/watch` layout so they clip to the watch face; at the root on `/`.
  const detailOverlay = detail ? (
    <div className={DETAIL_OVERLAY} role="presentation" onClick={(event) => { if (event.target === event.currentTarget) closeDetail(); }}>
      <section role="dialog" aria-modal="true" aria-labelledby="detailTitle" className={DETAIL_GLASS} tabIndex={-1} ref={detailRef}>
        <button type="button" id="detailClose" className={DETAIL_CLOSE} aria-label="Close details" onClick={closeDetail}>×</button>
        <div id="detailEyebrow" className={DETAIL_EYEBROW}>{detail.eyebrow}</div>
        <h2 id="detailTitle">{detail.title}</h2>
        {detail.value ? <p id="detailValue" className={DETAIL_VALUE}>{detail.value}</p> : null}
        <p id="detailMessage" className={DETAIL_MESSAGE}>{detail.message}</p>
        {detail.action ? (
          <button type="button" className={DETAIL_ACTION} onClick={detail.action.onClick}>{detail.action.label}</button>
        ) : null}
        <p id="detailFooter" className={DETAIL_FOOTER}>{detail.footer}</p>
      </section>
    </div>
  ) : null;

  // `/` renders the AI Elements chat overlay; `/watch` keeps the compact legacy ChatPanel inside the
  // watch face (it is sized for the glass, see watch-device.css).
  const chatPanel = chatOpen ? (
    variant === "watch" ? (
      <ChatPanel astronaut={selectedAstronaut ? { id: selectedAstronaut.id, name: selectedAstronaut.name } : null} onClose={() => setChatOpen(false)} onReply={(t) => { setPrompt(t.length > 160 ? `${t.slice(0, 157)}…` : t); setAnnouncer(t); }} />
    ) : (
      <SkyChatPanel astronaut={selectedAstronaut ? { id: selectedAstronaut.id, name: selectedAstronaut.name } : null} onClose={() => setChatOpen(false)} onReply={(t) => { setPrompt(t.length > 160 ? `${t.slice(0, 157)}…` : t); setAnnouncer(t); }} onUseVoice={() => {
        // Same as tapping the idle orb: only start capture from idle/error.
        setChatOpen(false);
        if (phase === "idle" || phase === "error") void toggle();
      }} />
    )
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
      onForceRelease={handleForceRelease}
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
    <main className={SKY_APP} data-phase={phase} aria-label="SKY astronaut wellness overview">
      {/* /watch always renders the vendored Topography behind the watch device (not the
          console's admin-configured backdrop): deep-navy page, dim cyan topographic lines, low
          speed, opacity <= 0.9 — the watch frame + caption stay the focal point. */}
      {variant === "watch" ? (
        <div className="absolute inset-0 z-0" aria-hidden="true">
          <Topography
            color="#5eead4"
            lineCount={18}
            lineWidth={1.1}
            speed={0.15}
            glow={0.35}
            depthOfField={0.5}
            fog={0.45}
            brightness={0.85}
            opacity={0.8}
            intro={fx}
          />
        </div>
      ) : bg === "galaxy" ? (
        <div className="absolute inset-0 z-0" aria-hidden="true">
          <Galaxy
            starColors={["#ffffff", "#78eaff", "#c8aaff"]}
            twinkleIntensity={0.5}
            glowIntensity={0.5}
            flareIntensity={0.4}
            density={0.85}
            starSpeed={0.5}
            saturation={0.55}
            mouseInteraction={true}
            dpr={1}
            transparent
            opacity={0.9}
            intro={fx}
          />
        </div>
      ) : (
        <div className="absolute inset-0 z-0" aria-hidden="true">
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
      )}
      <div className={SPACE_VIGNETTE} aria-hidden="true" />

      {variant === "watch" ? (
        <>
          {/* /watch IS the watch device: the live WatchHud + overlays (picker, chat, detail) clip
             inside the glass face of the AI-generated mockup on every viewport. */}
          <div className={WATCH_STAGE}>
            <div className={WATCH_DEVICE} role="group" aria-label={copy.hud.watchCaption}>
              <div className={WATCH_SCREEN}>
                {watchHud}
                {overlays}
              </div>
              <img className={WATCH_FRAME} src="/watch/mockup-futuristic-space-gray.png" alt="" aria-hidden="true" draggable={false} />
            </div>
            <p className={WATCH_CAPTION}>{copy.hud.watchCaption}</p>
          </div>
          {/* Floating Console | Watch chip — pinned top-right; hidden ≤480px (phone is watch-only). */}
          <DeviceSwitcher current="watch" className={DEVICE_SWITCHER_FLOAT} />
        </>
      ) : (
        <>
      {/* Header */}
      <header className={SKY_HEADER}>
        <button
          className={BRAND}
          type="button"
          aria-label="Return to SKY overview"
          onClick={() => {
            setDetail(null);
            setChatOpen(false);
            setGreeting(greetingFor(findAstronaut(astronautId, roster)));
            setPrompt("How are you feeling today?");
          }}
        >
          <span className={BRAND_RING} aria-hidden="true" />
          <span className={BRAND_COPY}>
            <span className={BRAND_NAME}><DepthText text="S K Y" fontSize="clamp(20px, 2.2vw, 29px)" fontWeight={300} layers={10} depth={0.5} tilt={4} autoOrbit={false} intro={false} shadow={false} depthColor="#6fa8d6" /></span>
            <span className={BRAND_TAGLINE}><ShinyText color="#9bb0c8" shineColor="#d6f2ff" speed={12}>Astronaut Wellness</ShinyText></span>
          </span>
        </button>
        <div className={SKY_HEADER_ACTIONS}>
        <button className={MISSION_TRIGGER} type="button" aria-label="Mission information" onClick={() => openDetail({
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
          <span className={STATION_ICON} aria-hidden="true">
            <svg viewBox="0 0 44 36" fill="none">
              <path d="m18 16 8-2M18 21l8-2M15 8l5 10-5 10M28 6l-5 11 5 11M3 12l11-5 4 6-12 5zM31 14l10-5-3 12-9 4z" stroke="currentColor" strokeWidth="1.5" />
              <path d="M11 8 5 23m31-13-7 17M4 6l7 25m28-24-7 25" stroke="currentColor" strokeWidth="1" />
            </svg>
          </span>
          <span className={MISSION_TEXT}>ISS&nbsp; · &nbsp;Day 170</span>
          <span className={MISSION_UNDERLINE} aria-hidden="true" />
        </button>
        <DeviceSwitcher current="console" />
        <Link
          id="spacecraftLink"
          to="/spacecraft"
          className={SPACECRAFT_LINK}
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
          <span>{copy.hud.spacecraftButton}</span>
        </Link>
        </div>
      </header>

      {/* Vitals projection */}
      <section className={VITALS_PROJECTION} aria-label="Sample physiological readings">
        <div className={VITALS_SHIELD} aria-hidden="true" />
        <button className={VITAL_TILE} type="button" aria-label="Heart rate, demo value 62 beats per minute" onClick={() => openDetail({ ...VITAL_DETAILS.heartRate, footer: DEFAULT_FOOTER })}>
          <span className={VITAL_ICON} aria-hidden="true">
            <svg viewBox="0 0 56 56" fill="none"><path d="M28 43 15.5 30.7C5.5 20.6 20.3 9.2 28 21c7.7-11.8 22.5-.4 12.5 9.7L28 43Z" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round" /></svg>
          </span>
          <span className={VITAL_VALUE}>{fx ? <CountUp to={VITAL_VALUES.heartRate} trigger="load" duration={1.2} decimals={0} /> : VITAL_VALUES.heartRate} <small>bpm</small></span>
        </button>
        <button className={VITAL_TILE} type="button" aria-label="Respiration, demo value 16 breaths per minute" onClick={() => openDetail({ ...VITAL_DETAILS.respiration, footer: DEFAULT_FOOTER })}>
          <span className={VITAL_ICON} aria-hidden="true">
            <svg viewBox="0 0 56 56" fill="none"><path d="M27.5 13v21m1-18 5-4m-5 12 5-6m-7 1-4-6M24 28c-2-5-3-7-5-6-6 1-11 14-8 21 2 5 10 4 14-1l1-11m5-3c2-5 3-7 5-6 6 1 11 14 8 21-2 5-10 4-14-1l-1-11" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </span>
          <span className={VITAL_VALUE}>{fx ? <CountUp to={VITAL_VALUES.respiration} trigger="load" duration={1.2} decimals={0} /> : VITAL_VALUES.respiration} <small>br/min</small></span>
        </button>
        <button className={VITAL_TILE} type="button" aria-label="Oxygen saturation, demo value 98 percent" onClick={() => openDetail({ ...VITAL_DETAILS.spo2, footer: DEFAULT_FOOTER })}>
          <span className={`${VITAL_ICON} ${VITAL_ICON_OXYGEN}`} aria-hidden="true">O<sub>2</sub></span>
          <span className={VITAL_VALUE}>{fx ? <CountUp to={VITAL_VALUES.spo2} trigger="load" duration={1.2} decimals={0} /> : VITAL_VALUES.spo2} <small>%</small></span>
        </button>
        <button className={VITAL_TILE} type="button" aria-label="Sleep, demo value seven hours and forty-two minutes" onClick={() => openDetail({ ...VITAL_DETAILS.sleep, footer: DEFAULT_FOOTER })}>
          <span className={VITAL_ICON} aria-hidden="true">
            <svg viewBox="0 0 56 56" fill="none"><path d="M39.8 39.2C29.2 45.6 15.5 39 13.6 26.5c-1-7.1 2.4-13.6 8.4-17.4-1.4 13.2 6.4 22.5 19.1 19-1.1 4.8-5 8.5-1.3 11.1Z" stroke="currentColor" strokeWidth="2.4" strokeLinejoin="round" /></svg>
          </span>
          <span className={VITAL_VALUE}>{fx ? <CountUp to={VITAL_VALUES.sleepHours} trigger="load" duration={1.2} decimals={0} /> : VITAL_VALUES.sleepHours} <small>h</small> {fx ? <CountUp to={VITAL_VALUES.sleepMinutes} trigger="load" duration={1.2} decimals={0} /> : VITAL_VALUES.sleepMinutes} <small>m</small></span>
        </button>
        <span className={DEMO_INDICATOR}>{fx ? <DecryptedText text={FIXTURE_LABEL} animateOn="view" loop={false} speed={50} /> : FIXTURE_LABEL}</span>
      </section>

      {/* Conversation */}
      <section className={CONVERSATION} aria-label="SKY conversation">
        <div className={`${ORB_ZONE}${phase === "thinking" ? ` ${ORB_ZONE_THINKING}` : ""}`} aria-hidden="true"><SkyOrb state={orbState} /></div>
        <div className={CONVERSATION_COPY} ref={conversationCopyRef}>
          <h1 id="greeting">{fx ? <BlurText text={greeting} animationFrom={{filter:"blur(10px)",opacity:0}} animationTo={[{filter:"blur(0px)",opacity:1}]} color="#ecf7ff" easing="easeOut" /> : greeting}</h1>
          <p id="prompt"><VariableProximity label={prompt} containerRef={conversationCopyRef} radius={60} /></p>
        </div>
        <VoiceWaveform phase={phase} energyRef={energyRef} />
        <p id="captions" className={CAPTIONS} aria-live="polite">
          {phase === "listening" ? "Microphone active · audio analysed locally" : phase === "error" ? "Microphone unavailable — type instead" : ""}
        </p>
      </section>

      {/* Health projection */}
      <section className={HEALTH_PROJECTION} aria-label="Health summary, simulated data">
        <div className={HEALTH_SHIELD} aria-hidden="true" />
        <Link id="hologramButton" to="/body" className={HOLOGRAM_LINK} aria-label="View simulated body health details">
          {/* Skin shell + skeleton in 3D when the browser can draw it; the drawn figure otherwise. */}
          <HologramBody reducedMotion={reduce} />
        </Link>
        {/* CC BY 4.0: the Open Anatomy model's credit stays on the card that shows it. */}
        <HoloCredit />
        <button type="button" id="healthButton" className={HEALTH_SUMMARY} aria-label="View simulated overall health assessment" onClick={() => openDetail({ ...DETAILS.health, footer: DEFAULT_FOOTER })}>
          <span className={HEALTH_LABEL}>Overall</span>
          <strong className={HEALTH_STATUS}><GradientText colors={["#7fe9c9","#5ee6ff","#7fe9c9"]} animationSpeed={3}>Stable</GradientText></strong>
          <span className={HEALTH_GUIDANCE}>Maintain recovery<br />and readiness</span>
          <span className={HEALTH_DEMO}>{fx ? <DecryptedText text="DEMO STATUS" animateOn="view" loop={false} speed={50} /> : "DEMO STATUS"}</span>
        </button>
      </section>

      {/* Voice control */}
      <div className={VOICE_CONTROL}>
        <div className={chatOpen ? `${VOICE_CLUSTER} ${VOICE_CLUSTER_DIMMED}` : VOICE_CLUSTER}>
          {/* Listening replaces the orb with the wide recording bar (shared with the declarative
              HUD). VoicePill's own audio is simulated — it never opens a MediaStream; `useSkyVoice`
              keeps the real analyser behind both visuals. */}
          {phase === "listening" || phase === "requesting_permission" ? (
            <ListeningBar
              onStop={() => {
                if (phase === "listening" || phase === "requesting_permission") void toggle();
              }}
              energyRef={energyRef}
              readSpectrum={readSpectrum}
              reducedMotion={!!reduce}
            />
          ) : (
            <VoicePill
              size={84}
              accentColor="#5eead4"
              iconColor="#bfe6ef"
              background="#0e2233"
              className="shadow-[0_0_28px_2px_rgba(94,234,212,.22),0_0_10px_rgba(120,234,255,.25)]"
              ariaLabel={MIC_ARIA[phase]}
              onStart={() => {
                if (phase === "idle" || phase === "error") void toggle();
              }}
              onStop={() => {
                if (phase === "listening" || phase === "requesting_permission") void toggle();
              }}
            />
          )}
          <div id="voiceHint" className={VOICE_HINT} aria-live="polite">
            <svg className={VOICE_SIGNAL} viewBox="0 0 16 15" fill="none" aria-hidden="true">
              <rect x="1" y="9" width="2.6" height="5" rx="1.3" fill="currentColor" />
              <rect x="5.4" y="6" width="2.6" height="8" rx="1.3" fill="currentColor" />
              <rect x="9.8" y="3" width="2.6" height="11" rx="1.3" fill="currentColor" />
              <rect x="14.2" y="1" width="1.4" height="13" rx="0.7" fill="currentColor" opacity=".55" />
            </svg>
            <span>{hint}</span>
          </div>
          <TypeInsteadPill
            label={copy.watch.typeInstead}
            ariaLabel={copy.hud.typeInsteadAria}
            pressed={chatOpen}
            onClick={() => setChatOpen((open) => !open)}
          />
        </div>
      </div>
        </>
      )}

      {/* Overlays at the root — inside the watch face in the framed `/watch` layout */}
      {variant === "watch" ? null : overlays}
      <div className="sr-only" role="status" aria-live="polite">{announcer}</div>
    </main>
  );
}
