import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMounted } from "../../shared/hooks/useMounted";
import { useReducedMotion } from "motion/react";
import { Link, useNavigate } from "@tanstack/react-router";
import DepthText from "../../shared/react-bits/DepthText/DepthText";
import LightTunnel from "../../shared/react-bits/LightTunnel/LightTunnel";
import Particles from "../../shared/react-bits/Particles/Particles";
import ShinyText from "../../shared/react-bits/ShinyText/ShinyText";
import VoicePill from "../../shared/react-bits/VoicePill/VoicePill";
import { format, useCopy } from "../../shared/i18n";
import {
  AstronautPicker,
  ASTRONAUT_STORAGE_KEY,
  ASTRONAUTS,
  findAstronaut,
  firstName,
  getAstronauts,
  listClaims,
  claimAstronaut,
  releaseAllClaims,
  getOrCreateSessionId,
  takenIdsOf,
  normalizeAstronautId,
  useClaimHeartbeat,
  useClaimsWatcher,
  CLAIMS_EPOCH_STORAGE_KEY,
} from "../astronaut";
import type { ClaimEntry } from "../astronaut";
import {
  BRAND,
  BRAND_COPY,
  BRAND_NAME,
  BRAND_RING,
  BRAND_TAGLINE,
  DETAIL_ACTION,
  DETAIL_CLOSE,
  DETAIL_EYEBROW,
  DETAIL_FOOTER,
  DETAIL_GLASS,
  DETAIL_MESSAGE,
  DETAIL_OVERLAY,
  DETAIL_VALUE,
  SPACECRAFT_LINK,
} from "../sky-hud/hud-classes";
import { DETAILS } from "../sky-hud/vitals";
import { SkyOrb } from "../sky-hud/SkyOrb";
import { VoiceWaveform } from "../sky-hud/VoiceWaveform";
import { useSkyVoice } from "../sky-hud/useSkyVoice";
import { useToggleChatShortcut } from "../sky-hud/useToggleChatShortcut";
import { MIC_ARIA, PHASE_TEXT } from "../sky-hud/voiceCopy";
import { HologramBody, HoloCredit, ListeningBar, TypeInsteadPill } from "../sky-hud/components";
import { DeviceSwitcher } from "../sky-hud/components/DeviceSwitcher";
import { SkyChatPanel } from "../sky-hud/components/SkyChatPanel";
import { HUD_MOCK, MISSION_DAY } from "./model/fixture";
import { buildInsightText } from "./model/insight";
import { roleLabel } from "./model/roles";
import {
  FOOTER,
  FOOTER_NOTE,
  GREETING,
  MOCK_CENTER,
  MOCK_GRID,
  MOCK_HEADER,
  MOCK_HEADER_ACTIONS,
  MOCK_LEFT,
  MOCK_MISSION,
  MOCK_RIGHT,
  MOCK_ROOT,
  MOCK_VIGNETTE,
  ORB_STAGE,
  ORB_ZONE,
  ORB_ZONE_THINKING,
  PROMPT,
  SIMULATED_CHIP,
  VOICE_CLUSTER,
  VOICE_CLUSTER_DIMMED,
  VOICE_CONTROL,
  VOICE_HINT,
} from "./mock-classes";
import { InsightBand } from "./components/InsightBand";
import { MiniCards, ReadinessCard, ReadinessDetail } from "./components/ReadinessPanel";
import { ProfileCard } from "./components/ProfileCard";
import { TrendsCard } from "./components/TrendsCard";
import { VitalsCard } from "./components/VitalsCard";

// Vendored react-bits sources are @ts-nocheck; their inferred prop types demand props the runtime
// defaults, so the boundary casts them (same pattern as `features/hud-gen/catalog.tsx`).
const ParticlesAny = Particles as any;
const LightTunnelAny = LightTunnel as any;
const DepthTextAny = DepthText as any;
const ShinyTextAny = ShinyText as any;

const DEFAULT_FOOTER = "Demonstration only · Not medical advice";

/** The signal glyph that leads the voice hint (four ascending bars, decorative). */
const VOICE_SIGNAL =
  "h-[13px] w-[15px] flex-none text-[#4be6c8] [filter:drop-shadow(0_0_5px_rgba(75,230,200,.45))]";

const VOICE_WAVE = "block h-[30px] w-[min(100%,260px)] max-[720px]:h-[24px]";

const GREETING_STACK = "flex flex-col items-center px-2 text-center";

interface DetailDialogProps {
  title: string;
  value?: string;
  message: string;
  eyebrow: string;
  footer: string;
  action?: { label: string; onClick: () => void };
}

/**
 * `/` — "SKY · Astronaut Wellness", the mock console.
 *
 * A three-column simulated dashboard around the unchanged voice orb: astronaut profile + vital
 * signs + quick trends on the left, orb/greeting/voice in the middle, overall readiness with four
 * detail tabs on the right, one deterministic insight band underneath. Every measurement is the
 * synthetic fixture in `model/fixture.ts`; nothing here reads a live sensor, the analog cohort data
 * of `/research`, or a medical threshold.
 *
 * Behaviour is the console's existing behaviour, copied from the previous default screens: the one
 * `useSkyVoice` MediaStream, ⌘K chat card via `SkyChatPanel`, crew claims + picker + force release,
 * announcement channel. Only the layout is new — `?gen=0` still renders the staged HUD and
 * `?arch=openui` the declarative hud-gen tree.
 */
export function SkyHudMock() {
  const copy = useCopy();
  const navigate = useNavigate();
  const mounted = useMounted();
  const reduce = useReducedMotion();
  const fx = mounted && !reduce;
  const [hint, setHint] = useState(PHASE_TEXT.idle);
  const [detail, setDetail] = useState<DetailDialogProps | null>(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [astronautId, setAstronautId] = useState<string | null>(null);
  const [roster, setRoster] = useState(() => [...ASTRONAUTS]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [claims, setClaims] = useState<ClaimEntry[]>([]);
  const [claiming, setClaiming] = useState(false);
  const [claimError, setClaimError] = useState(false);
  const sessionIdRef = useRef<string | null>(null);
  const [greeting, setGreeting] = useState(() => copy.hud.greetingFallback);
  const [prompt, setPrompt] = useState(() => copy.hud.promptFallback);
  const [announcer, setAnnouncer] = useState("");
  const [bg, setBg] = useState("particles");

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

  useEffect(() => {
    if (!mounted) return;
    try {
      const params = new URLSearchParams(window.location.search);
      const fromUrl = params.get("bg");
      const fromStorage = window.localStorage.getItem("nsac.bg");
      const raw = fromUrl ?? fromStorage;
      const chosen = raw === "light-tunnel" ? "light-tunnel" : "particles";
      setBg(chosen);
      if (fromUrl) window.localStorage.setItem("nsac.bg", chosen);
      else if (raw !== null && raw !== chosen) window.localStorage.setItem("nsac.bg", chosen);
    } catch {
      /* ignore */
    }
  }, [mounted]);

  const detailRef = useRef<HTMLDivElement | null>(null);
  const previousFocus = useRef<Element | null>(null);

  const { phase, energyRef, toggle, readEnergy, readSpectrum } = useSkyVoice((next) =>
    setHint(PHASE_TEXT[next]),
  );

  // ⌘K / Ctrl+K toggles the chat card from anywhere on the console.
  useToggleChatShortcut(() => setChatOpen((open) => !open), true);

  // Claim TTL heartbeat (no-op when SSR) + force-release watcher (console only).
  useClaimHeartbeat();
  useClaimsWatcher(() => {
    try {
      window.localStorage.removeItem(ASTRONAUT_STORAGE_KEY);
    } catch {
      /* storage unavailable → vẫn kick */
    }
    setAstronautId(null);
    setGreeting(copy.hud.greetingFallback);
    setPickerOpen(true);
  });

  // Backend roster is metadata only: the bundled fixture renders first and stays if it fails.
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

  const refreshClaims = useCallback(async (sid: string) => {
    try {
      const res = await listClaims({ data: { sessionId: sid } });
      setClaims(Array.isArray(res?.claims) ? res.claims : []);
    } catch {
      /* backend unreachable → claims simply not enforced */
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
        if (!res?.reachable) return;
        const epoch = typeof res.epoch === "number" ? res.epoch : null;
        let storedEpoch: string | null = null;
        try {
          storedEpoch = window.localStorage.getItem(CLAIMS_EPOCH_STORAGE_KEY);
        } catch {
          storedEpoch = null;
        }
        // Force release elsewhere bumped the epoch: drop the local pick, no silent re-claim.
        if (epoch !== null && storedEpoch !== null && storedEpoch !== String(epoch)) {
          try {
            window.localStorage.setItem(CLAIMS_EPOCH_STORAGE_KEY, String(epoch));
            window.localStorage.removeItem(ASTRONAUT_STORAGE_KEY);
          } catch {
            /* storage unavailable → vẫn kick */
          }
          setAstronautId(null);
          setGreeting(copy.hud.greetingFallback);
          setPickerOpen(true);
          return;
        }
        if (epoch !== null && storedEpoch === null) {
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
            setGreeting(copy.hud.greetingFallback);
            setPickerOpen(true);
          } else if (normalized) {
            // Returning after idle: the old claim may have expired. Re-claim silently; losing the
            // race behaves like `takenByOther`.
            void claimAstronaut({ data: { sessionId: sid, astronautId: normalized } })
              .then((claimed) => {
                if (!alive || claimed.ok) {
                  if (claimed.ok) {
                    setClaims((prev) =>
                      prev.map((c) => (c.astronautId === normalized ? { ...c, mine: true } : c)),
                    );
                  }
                  return;
                }
                if (claimed.reason !== "taken") return;
                try {
                  window.localStorage.removeItem(ASTRONAUT_STORAGE_KEY);
                  setAstronautId(null);
                  setGreeting(copy.hud.greetingFallback);
                  setPickerOpen(true);
                } catch {
                  /* storage unavailable → giữ nguyên */
                }
              })
              .catch(() => {
                /* keep the local pick */
              });
          }
        } catch {
          /* storage unavailable → giữ nguyên */
        }
      })
      .catch(() => {
        /* backend unreachable → claims not enforced */
      });
    return () => {
      alive = false;
    };
  }, [mounted, copy]);

  // One rAF loop feeds the waveform; orb/waveform read `energyRef` directly per frame.
  useEffect(() => {
    if (typeof window === "undefined") return;
    let frame = 0;
    let last = 0;
    const tick = (now: number) => {
      frame = requestAnimationFrame(tick);
      if (document.hidden) return;
      if (now - last < 33) return;
      last = now;
      readEnergy();
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [readEnergy]);

  const persistLocalPick = useCallback((astroId: string) => {
    try {
      window.localStorage.setItem(ASTRONAUT_STORAGE_KEY, astroId);
    } catch {
      /* ignore */
    }
  }, []);

  const handleAstronautSelect = useCallback(
    async (id: string) => {
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
          setClaimError(true);
        } else {
          // unavailable / unexpected → behave like the historical local pick (never block the demo)
          localPick();
        }
      } catch {
        localPick();
      } finally {
        setClaiming(false);
        void refreshClaims(sid);
      }
    },
    [roster, copy, persistLocalPick, refreshClaims],
  );

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
      setGreeting(copy.hud.greetingFallback);
      const sid = sessionIdRef.current ?? getOrCreateSessionId();
      sessionIdRef.current = sid;
      await refreshClaims(sid);
    }
    return res;
  }, [copy, refreshClaims]);

  const openDetail = useCallback(
    ({ title, value, message, eyebrow = "SIMULATED DATA", footer = DEFAULT_FOOTER }: DetailDialogProps) => {
      previousFocus.current = document.activeElement;
      setDetail({ title, value, message, eyebrow, footer });
      setAnnouncer(title);
    },
    [],
  );
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

  const openPicker = useCallback(() => {
    setClaimError(false);
    setPickerOpen(true);
  }, []);

  const selected = findAstronaut(astronautId, roster) ?? findAstronaut(ASTRONAUTS[0]!.id, roster) ?? ASTRONAUTS[0]!;
  const role = roleLabel(selected.role, copy.hudMock.roles);

  const orbNode = useMemo(
    () => (
      <div className={`${ORB_ZONE}${phase === "thinking" ? ` ${ORB_ZONE_THINKING}` : ""}`} aria-hidden="true">
        <SkyOrb phase={phase} energyRef={energyRef} />
      </div>
    ),
    [phase, energyRef],
  );

  const holo = useMemo(() => <HologramBody reducedMotion={!!reduce} />, [reduce]);

  const insightText = buildInsightText(copy.hudMock.insightText);

  return (
    <main className={MOCK_ROOT} data-phase={phase} aria-label="SKY astronaut wellness overview">
      {bg === "light-tunnel" ? (
        <div className="absolute inset-0 z-0" aria-hidden="true">
          <LightTunnelAny cableColor="#78eaff" pulseColor="#5dbafa" speed={0.08} tunnelOpacity={0} />
        </div>
      ) : (
        <div className="absolute inset-0 z-0" aria-hidden="true">
          <ParticlesAny
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
            intro={fx}
            opacity={0.9}
          />
        </div>
      )}
      <div className={MOCK_VIGNETTE} aria-hidden="true" />

      <header className={MOCK_HEADER}>
        <button
          className={BRAND}
          type="button"
          aria-label={copy.hud.brandAria}
          onClick={() => {
            setDetail(null);
            setChatOpen(false);
            setGreeting(
              astronautId && selected
                ? format(copy.astronaut.greeting, { name: firstName(selected.name) })
                : copy.hud.greetingFallback,
            );
            setPrompt(copy.hud.promptFallback);
          }}
        >
          <span className={BRAND_RING} aria-hidden="true" />
          <span className={BRAND_COPY}>
            <span className={BRAND_NAME}>
              <DepthTextAny
                text="S K Y"
                fontSize="clamp(20px, 2.2vw, 29px)"
                fontWeight={300}
                layers={10}
                depth={0.5}
                tilt={4}
                autoOrbit={false}
                intro={false}
                shadow={false}
                depthColor="#6fa8d6"
              />
            </span>
            <span className={BRAND_TAGLINE}>
              <ShinyTextAny color="#9bb0c8" shineColor="#d6f2ff" speed={12} intensity={0.4}>
                {copy.hud.tagline}
              </ShinyTextAny>
            </span>
          </span>
        </button>

        <div className={MOCK_HEADER_ACTIONS}>
          <button
            type="button"
            className={MOCK_MISSION}
            aria-label={copy.hud.missionAria}
            onClick={() =>
              openDetail({
                ...DETAILS.mission,
                footer: DEFAULT_FOOTER,
                action: {
                  label: copy.astronaut.change,
                  onClick: () => {
                    closeDetail();
                    openPicker();
                  },
                },
              })
            }
          >
            <span className="block h-[15px] w-[20px] [transform:rotate(-10deg)]" aria-hidden="true">
              <svg viewBox="0 0 44 36" fill="none">
                <path
                  d="m18 16 8-2M18 21l8-2M15 8l5 10-5 10M28 6l-5 11 5 11M3 12l11-5 4 6-12 5zM31 14l10-5-3 12-9 4z"
                  stroke="currentColor"
                  strokeWidth="1.5"
                />
                <path d="M11 8 5 23m31-13-7 17M4 6l7 25m28-24-7 25" stroke="currentColor" strokeWidth="1" />
              </svg>
            </span>
            <span>ISS&nbsp;·&nbsp;Day {MISSION_DAY}</span>
          </button>
          <DeviceSwitcher current="console" />
          <Link
            to="/spacecraft"
            className={SPACECRAFT_LINK}
            aria-label={copy.hud.spacecraftButtonAria}
          >
            <svg
              viewBox="0 0 48 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.7"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
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

      <div className={MOCK_GRID}>
        <div className={MOCK_LEFT} data-column="left">
          <ProfileCard
            name={selected.name}
            role={role}
            initials={selected.initial}
            avatarSrc={`/astronauts/${selected.id}.png`}
            copy={copy.hudMock}
            changeLabel={copy.astronaut.change}
            onChange={openPicker}
          />
          <VitalsCard vitalSigns={HUD_MOCK.vitalSigns} copy={copy.hudMock} />
          <TrendsCard trends={HUD_MOCK.quickTrends} copy={copy.hudMock} />
        </div>

        <div className={MOCK_CENTER} data-column="center">
          <div className={ORB_STAGE}>{orbNode}</div>

          <div className={GREETING_STACK}>
            <h1 className={GREETING}>{greeting}</h1>
            <p id="prompt" className={PROMPT}>
              {prompt}
            </p>
          </div>

          <VoiceWaveform phase={phase} energyRef={energyRef} className={VOICE_WAVE} />

          <div className={VOICE_CONTROL}>
            <div className={chatOpen ? `${VOICE_CLUSTER} ${VOICE_CLUSTER_DIMMED}` : VOICE_CLUSTER}>
              {phase === "listening" || phase === "requesting_permission" ? (
                <ListeningBar
                  onStop={() => void toggle()}
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
                  onStop={() => void toggle()}
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

          <InsightBand
            text={insightText}
            kicker={copy.hudMock.insightKicker}
            ariaLabel={copy.hudMock.insightOpen}
            onOpen={() => void navigate({ to: "/performance" })}
          />
        </div>

        <div className={MOCK_RIGHT} data-column="right">
          <ReadinessCard readiness={HUD_MOCK.readiness} copy={copy.hudMock} />
          <ReadinessDetail
            fixture={HUD_MOCK}
            copy={copy.hudMock}
            holo={holo}
            holoCredit={<HoloCredit placement="footer" />}
            onOpenBody={() => void navigate({ to: "/body" })}
          />
          <MiniCards cards={HUD_MOCK.cards} copy={copy.hudMock} />
        </div>
      </div>

      <footer className={FOOTER}>
        <p className={FOOTER_NOTE}>{copy.chat.footer}</p>
        <span className={SIMULATED_CHIP} data-testid="simulated-crew-chip">
          {copy.hudMock.simulatedCrew}
        </span>
      </footer>

      {detail ? (
        <div
          className={DETAIL_OVERLAY}
          role="presentation"
          onClick={(event) => {
            if (event.target === event.currentTarget) closeDetail();
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="detailTitle"
            className={DETAIL_GLASS}
            tabIndex={-1}
            ref={detailRef}
          >
            <button type="button" className={DETAIL_CLOSE} aria-label={copy.hudMock.detailClose} onClick={closeDetail}>
              ×
            </button>
            <div className={DETAIL_EYEBROW}>{detail.eyebrow}</div>
            <h2 id="detailTitle">{detail.title}</h2>
            {detail.value ? <p className={DETAIL_VALUE}>{detail.value}</p> : null}
            <p className={DETAIL_MESSAGE}>{detail.message}</p>
            {detail.action ? (
              <button type="button" className={DETAIL_ACTION} onClick={detail.action.onClick}>
                {detail.action.label}
              </button>
            ) : null}
            <p className={DETAIL_FOOTER}>{detail.footer}</p>
          </section>
        </div>
      ) : null}

      {chatOpen ? (
        <SkyChatPanel
          astronaut={{ id: selected.id, name: selected.name }}
          onClose={() => setChatOpen(false)}
          onReply={(text) => {
            setPrompt(text.length > 160 ? `${text.slice(0, 157)}…` : text);
            setAnnouncer(text);
          }}
          onUseVoice={() => {
            // Same as tapping the idle orb: only start capture from idle/error.
            setChatOpen(false);
            if (phase === "idle" || phase === "error") void toggle();
          }}
        />
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
          onForceRelease={handleForceRelease}
          onClose={
            astronautId
              ? () => {
                  setPickerOpen(false);
                  setClaimError(false);
                }
              : undefined
          }
        />
      ) : null}

      <div className="sr-only" role="status" aria-live="polite">
        {announcer}
      </div>
    </main>
  );
}
