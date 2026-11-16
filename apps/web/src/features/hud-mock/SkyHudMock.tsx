import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMounted } from "../../shared/hooks/useMounted";
import { useReducedMotion } from "motion/react";
import { useNavigate, useSearch } from "@tanstack/react-router";
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
import { DETAILS } from "../sky-hud/vitals";
import { SkyOrb } from "../sky-hud/SkyOrb";
import { agentStateForVoiceChat } from "../sky-hud/agent-state";
import { useToggleChatShortcut } from "../sky-hud/useToggleChatShortcut";
import { PHASE_TEXT } from "../sky-hud/voiceCopy";
import { useVoiceChat } from "./useVoiceChat";
import { HologramBody, HoloCredit } from "../sky-hud/components";
import { SkyChatPanel } from "../sky-hud/components/SkyChatPanel";
import { HUD_MOCK } from "./model/fixture";
import { buildInsightText } from "./model/insight";
import { roleLabel } from "./model/roles";
import { MOCK_GRID, MOCK_ROOT, MOCK_VIGNETTE } from "./mock-classes";
import { InsightBand } from "./components/InsightBand";
import { CenterColumn, LeftColumn, RightColumn } from "./components/MockColumns";
import { MiniCards, ReadinessCard, ReadinessDetail } from "./components/ReadinessPanel";
import { ProfileCard } from "./components/ProfileCard";
import { TrendsCard } from "./components/TrendsCard";
import { VitalsCard } from "./components/VitalsCard";
import { HudBackdrop } from "./components/HudBackdrop";
import { MockHeader } from "./components/MockHeader";
import { MockFooter } from "./components/MockFooter";
import { GreetingStack } from "./components/GreetingStack";
import { OrbStage } from "./components/OrbStage";
import { VoiceWave } from "./components/VoiceWave";
import { VoiceCluster } from "./components/VoiceCluster";
import { DetailOverlay } from "./components/DetailOverlay";
import type { DetailDialogProps } from "./components/DetailOverlay";
import { useHudBackground } from "../hud-bg";
import { applyLiveVitals, useLiveHealth } from "../live-health";

const DEFAULT_FOOTER = "Demonstration only · Not medical advice";


/**
 * `/` — "SKY · Astronaut Wellness", the mock console.
 *
 * A three-column simulated dashboard around the unchanged voice orb: astronaut profile + vital
 * signs + quick trends on the left, orb/greeting/voice in the middle, overall readiness with four
 * detail tabs on the right, one deterministic insight band underneath. Every measurement is the
 * synthetic fixture in `model/fixture.ts`; nothing here reads a live sensor, the analog cohort data
 * of `/research`, or a medical threshold.
 *
 * Behaviour is the console's existing behaviour, copied from the previous default screens: the
 * ⌘K chat card via `SkyChatPanel`, crew claims + picker + force release, announcement channel;
 * the mic speaks to the ElevenLabs Speech Engine (`useVoiceChat` — registration binds the pick,
 * the SDK owns mic capture, speaker output and the frequency bins feeding `ListeningBar`).
 *
 * This file owns the layout, and `?arch=openui` (`features/hud-gen`) renders the SAME modules: the
 * header/footer, columns, cards, orb stage, greeting, voice cluster, insight band, backdrop and
 * detail dialog all live in `./components/` and `./mock-classes.ts`. A layout change here is a
 * change to both screens — `features/hud-gen/model/preset-parity.test.ts` guards the region order.
 */
export function SkyHudMock() {
  const copy = useCopy();
  const navigate = useNavigate();
  // SSR always renders this mock (the `?arch=openui` opt-back swaps in after mount), so hide the
  // locale chip for that URL — its markup stays identical to before the chip existed.
  const search = useSearch({ strict: false }) as { arch?: string };
  const showLanguageSwitcher = search.arch !== "openui";
  const mounted = useMounted();
  const reduce = useReducedMotion();
  const fx = mounted && !reduce;
  const [detail, setDetail] = useState<DetailDialogProps | null>(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [astronautId, setAstronautId] = useState<string | null>(null);
  const [roster, setRoster] = useState(() => [...ASTRONAUTS]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [claims, setClaims] = useState<ClaimEntry[]>([]);
  const [claiming, setClaiming] = useState(false);
  const [claimError, setClaimError] = useState(false);
  const sessionIdRef = useRef<string | null>(null);
  // A Sky reply replaces the prompt line; null means the locale-aware fallback is shown.
  const [promptReply, setPromptReply] = useState<string | null>(null);
  const [announcer, setAnnouncer] = useState("");
  // The `/` backdrop is admin-configured (`/admin/background`): default particles, galaxy after
  // mount when saved. `?bg=` / `nsac.bg` are retired — admin always wins.
  const bg = useHudBackground();

  // Live (simulated) habitat telemetry for the picked crew member. Before the first read — and on
  // every failure — the fixture rows render untouched, so the mock stays byte-identical offline.
  const liveHealth = useLiveHealth(astronautId);
  const vitalSigns = useMemo(() => applyLiveVitals(HUD_MOCK.vitalSigns, liveHealth.data?.metrics), [liveHealth.data]);

  useEffect(() => {
    if (!mounted) return;
    try {
      const stored = window.localStorage.getItem(ASTRONAUT_STORAGE_KEY);
      const astro = findAstronaut(stored);
      if (astro) {
        setAstronautId(astro.id);
      } else {
        setPickerOpen(true);
      }
    } catch {
      setPickerOpen(true);
    }
  }, [mounted]);

  const detailRef = useRef<HTMLDivElement | null>(null);
  const previousFocus = useRef<Element | null>(null);

  // Speech Engine voice chat (ElevenLabs): owns the mic capture and the speaker output; the
  // hook maps conversation state onto the same phase/hint surface the console already renders.
  const {
    status: voiceStatus,
    mode: voiceMode,
    notice: voiceNotice,
    energyRef,
    wavePhase: phase,
    readSpectrum,
    syncEnergy,
    start: startVoiceChat,
    stop: stopVoiceChat,
    setNotice: setVoiceNotice,
  } = useVoiceChat(astronautId);
  const orbState = agentStateForVoiceChat(voiceStatus, voiceMode, voiceNotice);

  // Quiet hints (not configured / failed) clear themselves back to the idle line.
  useEffect(() => {
    if (!voiceNotice) return;
    const timer = window.setTimeout(() => setVoiceNotice(null), 4500);
    return () => window.clearTimeout(timer);
  }, [voiceNotice, setVoiceNotice]);

  const hint =
    voiceStatus === "connecting"
      ? copy.hudMock.voiceConnecting
      : voiceStatus === "live"
        ? voiceMode === "speaking"
          ? copy.hudMock.voiceSpeaking
          : copy.hudMock.voiceListening
        : voiceNotice === "notConfigured"
          ? copy.hudMock.voiceNotConfigured
          : voiceNotice === "failed"
            ? copy.hudMock.voiceFailed
            : PHASE_TEXT.idle;

  // Announce voice transitions to screen readers.
  useEffect(() => {
    setAnnouncer(
      voiceStatus === "connecting"
        ? copy.hudMock.voiceConnecting
        : voiceStatus === "live"
          ? voiceMode === "speaking"
            ? copy.hudMock.voiceSpeaking
            : copy.hudMock.voiceListening
          : "",
    );
  }, [voiceStatus, voiceMode, copy]);

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
      syncEnergy();
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [syncEnergy]);

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
  const greeting = astronautId
    ? format(copy.astronaut.greeting, { name: firstName(selected.name) })
    : copy.hud.greetingFallback;
  const prompt = promptReply ?? copy.hud.promptFallback;
  const role = roleLabel(selected.role, copy.hudMock.roles);

  const orbNode = useMemo(() => <SkyOrb state={orbState} />, [orbState]);

  const holo = useMemo(() => <HologramBody reducedMotion={!!reduce} />, [reduce]);

  const insightText = buildInsightText(copy.hudMock.insightText);

  return (
    <main className={MOCK_ROOT} data-phase={phase} data-agent-state={orbState} aria-label="SKY astronaut wellness overview">
      <HudBackdrop bg={bg} fx={fx} />
      <div className={MOCK_VIGNETTE} aria-hidden="true" />

      <MockHeader
        copy={copy}
        showLanguageSwitcher={showLanguageSwitcher}
        onBrand={() => {
          setDetail(null);
          setChatOpen(false);
          setPromptReply(null);
        }}
        onMission={() =>
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
      />

      <div className={MOCK_GRID}>
        <LeftColumn>
          <ProfileCard
            name={selected.name}
            role={role}
            initials={selected.initial}
            avatarSrc={`/astronauts/${selected.id}.png`}
            copy={copy.hudMock}
            changeLabel={copy.astronaut.change}
            onChange={openPicker}
          />
          <VitalsCard vitalSigns={vitalSigns} copy={copy.hudMock} />
          <TrendsCard trends={HUD_MOCK.quickTrends} copy={copy.hudMock} />
        </LeftColumn>

        <CenterColumn>
          <OrbStage orb={orbNode} chatOpen={chatOpen} thinking={voiceStatus === "connecting"} />

          <GreetingStack greeting={greeting} prompt={prompt} />

          <VoiceWave phase={phase} energyRef={energyRef} chatOpen={chatOpen} />

          <VoiceCluster
            phase={phase}
            hint={hint}
            micLabel={copy.watch.speakToSky}
            live={voiceStatus !== "idle"}
            chatOpen={chatOpen}
            reducedMotion={!!reduce}
            energyRef={energyRef}
            readSpectrum={readSpectrum}
            onStart={() => {
              if (!astronautId) {
                setPickerOpen(true);
                return;
              }
              if (voiceStatus === "idle") void startVoiceChat();
            }}
            onStop={() => void stopVoiceChat()}
            typeInsteadLabel={copy.watch.typeInstead}
            typeInsteadAria={copy.hud.typeInsteadAria}
            onToggleChat={() => setChatOpen((open) => !open)}
          />

          <InsightBand
            text={insightText}
            kicker={copy.hudMock.insightKicker}
            ariaLabel={copy.hudMock.insightOpen}
            onOpen={() => void navigate({ to: "/performance" })}
            dismissed={chatOpen}
          />
        </CenterColumn>

        <RightColumn>
          <ReadinessCard readiness={HUD_MOCK.readiness} copy={copy.hudMock} />
          <ReadinessDetail
            fixture={HUD_MOCK}
            copy={copy.hudMock}
            holo={holo}
            holoCredit={<HoloCredit placement="footer" />}
            onOpenBody={() => void navigate({ to: "/body" })}
          />
          <MiniCards cards={HUD_MOCK.cards} copy={copy.hudMock} />
        </RightColumn>
      </div>

      <MockFooter note={copy.chat.footer} />

      {detail ? (
        <DetailOverlay
          detail={detail}
          closeLabel={copy.hudMock.detailClose}
          onClose={closeDetail}
          dialogRef={detailRef}
        />
      ) : null}

      {chatOpen ? (
        <SkyChatPanel
          astronaut={{ id: selected.id, name: selected.name }}
          onClose={() => setChatOpen(false)}
          onReply={(text) => {
            setPromptReply(text.length > 160 ? `${text.slice(0, 157)}…` : text);
            setAnnouncer(text);
          }}
          onUseVoice={() => {
            // Same as tapping the idle orb: only start the voice chat from idle.
            setChatOpen(false);
            if (!astronautId) {
              setPickerOpen(true);
              return;
            }
            if (voiceStatus === "idle") void startVoiceChat();
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
