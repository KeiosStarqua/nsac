import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import "../sky-hud/hud-screen.css";
import { useMounted } from "../../shared/hooks/useMounted";
import { useReducedMotion } from "motion/react";
import LightTunnel from "../../shared/react-bits/LightTunnel/LightTunnel";
// react-bits sources are @ts-nocheck; their inferred prop types demand props with runtime defaults.
const LightTunnelAny = LightTunnel as any;
import { useSkyVoice } from "../sky-hud/useSkyVoice";
import { PHASE_TEXT, MIC_ARIA } from "../sky-hud/voiceCopy";
import { SpaceArt } from "../sky-hud/SpaceArt";
import { SkyOrb } from "../sky-hud/SkyOrb";
import { VoiceWaveform } from "../sky-hud/VoiceWaveform";
import { DETAILS, VITAL_DETAILS } from "../sky-hud/vitals";
import { AstronautPicker, ASTRONAUT_STORAGE_KEY, ASTRONAUTS, findAstronaut, firstName, getAstronauts, listClaims, claimAstronaut, getOrCreateSessionId, takenIdsOf, normalizeAstronautId } from "../astronaut";
import type { ClaimEntry } from "../astronaut";
import { ChatPanel } from "../sky-hud/components/ChatPanel";
import { WatchHud } from "../sky-hud/components/WatchHud";
import { useWatchViewport } from "../../shared/hooks/useWatchViewport";
import { Renderer } from "@openuidev/react-lang";
import { useNavigate } from "@tanstack/react-router";
import { format, useCopy, useLocale } from "../../shared/i18n";
import { hudLibrary, parseHudProgram } from "./catalog";
import { HudScopeProvider, type HudScopeValue } from "./scope";
import { buildHudFacts } from "./model/facts";
import { hudPreset } from "./presets";
import { MAX_PROGRAM_CHARS, reviewProgram } from "./model/review";
import { HUD_COMPONENT_NAMES, HUD_VITAL_KINDS } from "./model/names";
import { composeHud } from "~/features/agent/api/hud-compose.functions";
import type { VitalKind } from "../sky-hud/types";

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
 * `/?gen=1` — the SKY HUD with the ENTIRE staged display tree declared as OpenUI Lang
 * (@openuidev/react-lang, pinned 1.1.0) against the purpose-built catalog in `catalog.tsx`.
 * Data comes from fixtures + astronaut claims + locale at render time; values reach the tree only
 * through Fact/MetricTile resolved from the HUD facts builder — never as literals in the program.
 *
 * The preset is the primary path. The `sky-hud-composer` agent (per-astronaut PI SDK session,
 * `var/sky-sessions/<id>.hud.jsonl`) may replace it after review passes; on any failure the preset
 * silently stays, so `?gen=0` / the default route remain untouched.
 *
 * Logic mirrors SkyScreen.tsx 1:1 (voice, rAF loop, picker + claims, bg, watch viewport, dialogs,
 * announcer). Below 480px the shared WatchHud renders instead of the staged tree — the glanceable
 * watch layout is deliberately not part of the declarative tree.
 */
export function SkyScreenGen() {
  const copy = useCopy();
  const locale = useLocale();
  const navigate = useNavigate();
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
  const isWatch = useWatchViewport();
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
  const [greeting, setGreeting] = useState(() => copy.hud.greetingFallback);
  const [prompt, setPrompt] = useState(() => copy.chat.placeholder);
  const [announcer, setAnnouncer] = useState("");
  const [bg, setBg] = useState("light-tunnel");
  // Agent enhancement: the composed program, once accepted by review. Preset stays until then.
  const [agentProgram, setAgentProgram] = useState<string | null>(null);
  const [composeHintDismissed, setComposeHintDismissed] = useState(false);
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

  const { phase, energyRef, toggle, readEnergy } = useSkyVoice((next) => setHint(PHASE_TEXT[next]));

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
              setGreeting(copy.hud.greetingFallback);
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
  }, [mounted, copy]);

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

  // Agent enhancement: ask the per-astronaut composer for a layout once we know who is flying.
  // Any failure (no key, network, timeout, review rejection) silently keeps the preset.
  useEffect(() => {
    if (!astronautId) return;
    let alive = true;
    setAgentProgram(null);
    setComposeHintDismissed(false);
    void composeHud({ data: { astronautId, locale } })
      .then((res) => {
        if (!alive || res.status !== "ok" || typeof res.program !== "string") return;
        const review = reviewProgram(res.program, { allowList: HUD_COMPONENT_NAMES, maxChars: MAX_PROGRAM_CHARS }, parseHudProgram);
        if (!review.ok) {
          console.info("[sky] hud-gen: agent program rejected", review.reasons);
          return;
        }
        setAgentProgram(review.program);
      })
      .catch(() => { /* preset stays */ });
    return () => {
      alive = false;
    };
  }, [astronautId, locale]);

  const selectedAstronaut = findAstronaut(astronautId, roster);
  const greetingFor = useCallback(
    (astro: typeof selectedAstronaut) =>
      astro ? format(copy.astronaut.greeting, { name: firstName(astro.name) }) : copy.hud.greetingFallback,
    [copy],
  );

  const resetView = useCallback(() => {
    setDetail(null);
    setChatOpen(false);
    setGreeting(greetingFor(findAstronaut(astronautId, roster)));
    setPrompt(copy.chat.placeholder);
  }, [astronautId, roster, greetingFor, copy]);

  const facts = useMemo(buildHudFacts, []);
  const orbNode = useMemo(() => <SkyOrb phase={phase} energyRef={energyRef} />, [phase, energyRef]);
  const waveNode = useMemo(() => <VoiceWaveform phase={phase} energyRef={energyRef} />, [phase, energyRef]);

  const captions =
    phase === "listening" ? copy.hud.captionsListening : phase === "error" ? copy.hud.captionsError : "";

  const scope = useMemo<HudScopeValue>(
    () => ({
      copy,
      locale,
      facts,
      missionLabel: DETAILS.mission.value,
      fx,
      phase,
      hint,
      micAria: MIC_ARIA[phase],
      captions,
      greeting,
      prompt,
      chatOpen,
      pickerOpen,
      composeOrigin: agentProgram ? "agent" : "preset",
      composeHint: copy.hud.composeHint,
      composeHintDismissed,
      conversationCopyRef,
      orbNode,
      waveNode,
      resetView,
    }),
    [copy, locale, facts, fx, phase, hint, captions, greeting, prompt, chatOpen, pickerOpen, agentProgram, composeHintDismissed, orbNode, waveNode, resetView],
  );

  const program = agentProgram ?? hudPreset(locale);

  const handleAction = useCallback(
    (event: { type: string; params?: Record<string, unknown> }) => {
      switch (event.type) {
        case "OpenVital": {
          const kind = event.params?.kind;
          if (typeof kind !== "string" || !(HUD_VITAL_KINDS as readonly string[]).includes(kind)) return;
          openDetail({ ...VITAL_DETAILS[kind as VitalKind], footer: DEFAULT_FOOTER });
          return;
        }
        case "OpenWellness":
          openDetail({ ...DETAILS.health, footer: DEFAULT_FOOTER });
          return;
        case "OpenMission":
          openDetail({
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
          });
          return;
        case "OpenHologram":
          void navigate({ to: "/body" });
          return;
        case "ChangeAstronaut":
          setClaimError(false);
          setPickerOpen(true);
          return;
        case "ToggleChat":
          setChatOpen((value) => !value);
          return;
        case "ToggleMic":
          void toggle();
          return;
        case "DismissComposeHint":
          setComposeHintDismissed(true);
          return;
        default:
          break;
      }
    },
    [copy, openDetail, closeDetail, navigate, toggle],
  );

  return (
    <main className="sky-app" data-phase={phase} aria-label="SKY astronaut wellness overview">
      {bg === "light-tunnel" ? (
        <div style={{ position: "absolute", inset: 0, zIndex: 0 }} aria-hidden="true">
          <LightTunnelAny cableColor="#78eaff" pulseColor="#5dbafa" speed={0.08} tunnelOpacity={0} />
        </div>
      ) : (
        <SpaceArt />
      )}
      <div className="space-vignette" aria-hidden="true" />

      {isWatch ? (
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
          onTypeInstead={() => setChatOpen(true)}
        />
      ) : (
        <HudScopeProvider value={scope}>
          <Renderer response={program} library={hudLibrary} isStreaming={false} onAction={handleAction} />
        </HudScopeProvider>
      )}

      {/* Detail overlay */}
      {detail ? (
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
      ) : null}

      {/* Text chat */}
      {chatOpen ? (
        <ChatPanel astronaut={selectedAstronaut ? { id: selectedAstronaut.id, name: selectedAstronaut.name } : null} onClose={() => setChatOpen(false)} onReply={(t) => { setPrompt(t.length > 160 ? `${t.slice(0, 157)}…` : t); setAnnouncer(t); }} />
      ) : null}

      {mounted && pickerOpen ? (
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
      ) : null}
      <div className="sr-only" role="status" aria-live="polite">{announcer}</div>
    </main>
  );
}
