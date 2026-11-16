import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMounted } from "../../shared/hooks/useMounted";
import { useReducedMotion } from "motion/react";
import { CHAT_OVERRIDE_CHIP } from "../sky-hud/hud-classes";
import { useVoiceChat } from "../sky-hud/useVoiceChat";
import { agentStateForVoiceChat } from "../sky-hud/agent-state";
import { useToggleChatShortcut } from "../sky-hud/useToggleChatShortcut";
import { PHASE_TEXT } from "../sky-hud/voiceCopy";
import { SkyOrb } from "../sky-hud/SkyOrb";
import { DETAILS, VITAL_DETAILS } from "../sky-hud/vitals";
import type { VitalKind } from "../sky-hud/types";
import { AstronautPicker, ASTRONAUT_STORAGE_KEY, ASTRONAUTS, findAstronaut, firstName, getAstronauts, listClaims, claimAstronaut, releaseAllClaims, getOrCreateSessionId, takenIdsOf, normalizeAstronautId, useClaimHeartbeat, useClaimsWatcher, CLAIMS_EPOCH_STORAGE_KEY } from "../astronaut";
import type { ClaimEntry } from "../astronaut";
import { SkyChatPanel } from "../sky-hud/components/SkyChatPanel";
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
import { HUD_COMPONENT_NAMES } from "./model/names";
import { composeHud } from "~/features/agent/api/hud-compose.functions";
import { useHudBackground } from "../hud-bg";
import { DetailOverlay, type DetailDialogProps } from "./components/DetailOverlay";
import { HudBackdrop } from "./components/HudBackdrop";
import { applyLiveVitals, liveStripMode, useLiveHealth } from "../live-health";
import { HUD_MOCK } from "./data/fixture";
import { MOCK_ROOT, MOCK_VIGNETTE } from "./mock-classes";

/**
 * The Hub Gen console (`/`) with its ENTIRE display tree declared as OpenUI Lang
 * (@openuidev/react-lang, pinned 1.1.0) against the catalog in `catalog.tsx`.
 *
 * The catalog renders the console's own modules (`features/hud-gen/components/*`) and classes, so
 * the preset, a composed program and the chrome are one design: same header, grid, cards, copy and
 * fixture. The voice path is the ElevenLabs Speech Engine (`useVoiceChat`).
 *
 * The preset is the primary path. The `sky-hud-composer` agent (per-astronaut PI SDK session,
 * `var/sky-sessions/<id>.hud.jsonl`) may replace it after review passes; on any failure the preset
 * silently stays.
 *
 * Host logic (voice, rAF loop, picker + claims, bg, watch viewport, dialogs, announcer) is its own;
 * below 480px the shared WatchHud renders instead of the tree — the glanceable watch layout is
 * deliberately not part of the declarative tree.
 */
export function SkyScreenGen() {
  const copy = useCopy();
  const locale = useLocale();
  const navigate = useNavigate();
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
  const [claiming, setClaiming] = useState(false);
  const [claimError, setClaimError] = useState(false);
  const sessionIdRef = useRef<string | null>(null);
  const [greeting, setGreeting] = useState(() => copy.hud.greetingFallback);
  const [prompt, setPrompt] = useState(() => copy.hud.promptFallback);
  const [announcer, setAnnouncer] = useState("");
  // Admin-configured backdrop (`/admin/background`): particles default, Galaxy after mount when
  // saved. `?bg=` / `nsac.bg` are retired — admin always wins.
  const bg = useHudBackground();
  // Agent enhancement: the composed program, once accepted by review. Preset stays until then.
  const [agentProgram, setAgentProgram] = useState<string | null>(null);
  // Chat override: the program `show_on_hud` delivered on this screen. Replaces the WHOLE tree
  // (`overrideProgram ?? agentProgram ?? preset`); the chip clears it.
  const [overrideProgram, setOverrideProgram] = useState<string | null>(null);
  // The dock value the harness set on the `ui` frame (`artifacts.chatDock`): "right" only while the
  // override is on screen. Applied here — the client never infers it from the override itself.
  const [chatDock, setChatDock] = useState<"axis" | "right">("axis");
  const [composeHintDismissed, setComposeHintDismissed] = useState(false);
  const detailRef = useRef<HTMLDivElement | null>(null);
  const previousFocus = useRef<Element | null>(null);

  const {
    status: voiceStatus,
    mode: voiceMode,
    notice: voiceNotice,
    energyRef,
    wavePhase,
    readSpectrum,
    syncEnergy,
    start: startVoiceChat,
    stop: stopVoiceChat,
    setNotice: setVoiceNotice,
  } = useVoiceChat(astronautId);
  // Live (simulated) habitat telemetry for the followed crew member, bound into the declarative
  // tree at render time. Fixture until the first read settles.
  const liveHealth = useLiveHealth(astronautId);
  const liveVitalSigns = useMemo(() => applyLiveVitals(HUD_MOCK.vitalSigns, liveHealth.data?.metrics), [liveHealth.data]);
  const liveMode = liveHealth.settled ? liveStripMode(liveHealth.data) : null;
  const liveLabel =
    liveMode === "live"
      ? copy.live.visibleLive
      : liveMode === "historical"
        ? copy.live.historicalLabel
        : liveMode === "offline"
          ? copy.live.offlineLabel
          : null;
  const live = liveMode && liveLabel ? { vitals: liveVitalSigns, mode: liveMode, label: liveLabel } : null;

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
          : voiceMode === "thinking"
            ? copy.hudMock.voiceThinking
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
            : voiceMode === "thinking"
              ? copy.hudMock.voiceThinking
              : copy.hudMock.voiceListening
          : "",
    );
  }, [voiceStatus, voiceMode, copy]);

  // One start/stop helper — every mic entry point (ToggleMic, the watch layout, "Use voice")
  // taps the same button: idle starts, anything else ends the session.
  const toggleVoiceChat = useCallback(() => {
    if (voiceStatus === "idle") void startVoiceChat();
    else void stopVoiceChat();
  }, [voiceStatus, startVoiceChat, stopVoiceChat]);

  // ⌘K / Ctrl+K anywhere on the console toggles the chat card (the watch layout has no chat card).
  useToggleChatShortcut(() => setChatOpen((open) => !open), !isWatch);

  // Claim TTL: đập heartbeat mỗi 30 s khi tab visible để claim không bị backend giải phóng sau
  // 30 phút idle (no-op khi SSR).
  useClaimHeartbeat();

  // Force release ở tab khác: backend bump epoch → tab đang mở cũng bỏ pick của mình (poll 45 s,
  // chỉ khi tab visible). PickerOpening là phản hồi duy nhất, không cần announcer.
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
            setGreeting(copy.hud.greetingFallback);
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
              setGreeting(copy.hud.greetingFallback);
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
                    setGreeting(copy.hud.greetingFallback);
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
        /* backend unreachable → claims not enforced */
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
    const tick = (now: number) => {
      frame = requestAnimationFrame(tick);
      if (document.hidden) return;
      if (now - last < 33) return;
      last = now;
      syncEnergy();
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [syncEnergy]);

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
      setGreeting(copy.hud.greetingFallback);
      const sid = sessionIdRef.current ?? getOrCreateSessionId();
      sessionIdRef.current = sid;
      await refreshClaims(sid);
    }
    return res;
  }, [copy, refreshClaims]);

  const openDetail = useCallback(({ title, value, message, eyebrow = "SIMULATED DATA" }: DetailDialogProps) => {
    previousFocus.current = document.activeElement;
    setDetail({ title, value, message, eyebrow });
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
    setOverrideProgram(null);
    setChatDock("axis");
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
    setOverrideProgram(null);
    setChatDock("axis");
    setGreeting(greetingFor(findAstronaut(astronautId, roster)));
    setPrompt(copy.hud.promptFallback);
  }, [astronautId, roster, greetingFor, copy]);

  // Chat → HUD: `show_on_hud` delivered a program the server already reviewed; review again on the
  // client (cheap, and the gate must hold wherever a program lands) and swap the whole tree. The dock
  // comes from the harness (`chatDock` on the same frame), never inferred from the override here.
  const handleChatProgram = useCallback((program: string, chatDock?: "right") => {
    const review = reviewProgram(program, { allowList: HUD_COMPONENT_NAMES, maxChars: MAX_PROGRAM_CHARS }, parseHudProgram);
    if (!review.ok) {
      console.info("[sky] chat HUD program rejected", review.reasons);
      return;
    }
    setOverrideProgram(review.program);
    setChatDock(chatDock === "right" ? "right" : "axis");
    setAnnouncer(copy.hud.chatOverrideBack);
  }, [copy]);

  const clearChatOverride = useCallback(() => {
    setOverrideProgram(null);
    setChatDock("axis");
  }, []);

  // Same crew fallback as the roster: the crew member always has a profile, even before a claim.
  const shown = selectedAstronaut ?? findAstronaut(ASTRONAUTS[0]!.id, roster) ?? ASTRONAUTS[0]!;

  const facts = useMemo(buildHudFacts, []);
  const orbNode = useMemo(() => <SkyOrb state={orbState} />, [orbState]);

  const handleAction = useCallback(
    (event: { type: string; params?: Record<string, unknown> }) => {
      switch (event.type) {
        case "OpenMission":
          openDetail({
            ...DETAILS.mission,
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
        case "ChangeAstronaut":
          setClaimError(false);
          setPickerOpen(true);
          return;
        case "ToggleChat":
          setChatOpen((value) => !value);
          return;
        case "ToggleMic":
          toggleVoiceChat();
          return;
        case "DismissComposeHint":
          setComposeHintDismissed(true);
          return;
        default:
          break;
      }
    },
    [copy, openDetail, closeDetail, toggleVoiceChat],
  );

  const scope = useMemo<HudScopeValue>(
    () => ({
      copy,
      facts,
      astronaut: {
        id: shown.id,
        name: shown.name,
        initial: shown.initial,
        role: shown.role,
      },
      fx,
      phase: wavePhase,
      hint,
      energyRef,
      readSpectrum,
      greeting,
      prompt,
      chatOpen,
      composeOrigin: agentProgram ? "agent" : "preset",
      composeHint: copy.hud.composeHint,
      composeHintDismissed,
      orbNode,
      live,
      resetView,
      onAction: handleAction,
    }),
    [copy, facts, shown, fx, wavePhase, hint, energyRef, readSpectrum, greeting, prompt, chatOpen, agentProgram, composeHintDismissed, orbNode, live, resetView, handleAction],
  );

  const program = overrideProgram ?? agentProgram ?? hudPreset(locale);

  return (
    <main className={MOCK_ROOT} data-phase={wavePhase} data-agent-state={orbState} aria-label="SKY astronaut wellness overview">
      <HudBackdrop bg={bg} fx={fx} />
      <div className={MOCK_VIGNETTE} aria-hidden="true" />

      {isWatch ? (
        <WatchHud
          phase={wavePhase}
          hint={hint}
          micDisabled={voiceStatus === "connecting"}
          astronautName={selectedAstronaut ? firstName(selectedAstronaut.name) : null}
          onToggleMic={toggleVoiceChat}
          onSelectCrew={() => {
            setClaimError(false);
            setPickerOpen(true);
          }}
          onVital={(kind: VitalKind) => openDetail({ ...VITAL_DETAILS[kind] })}
          onHealth={() => openDetail({ ...DETAILS.health })}
        />
      ) : (
        <HudScopeProvider value={scope}>
          <Renderer.Root response={program} library={hudLibrary} isStreaming={false} onAction={handleAction}>
            {/* `contents`: the renderer's wrapper must not become a flex box inside MOCK_ROOT — the
                tree's header/grid/footer are the console's own flex children (same layout as `/`). */}
            <Renderer.Content className="contents" />
          </Renderer.Root>
        </HudScopeProvider>
      )}

      {/* Detail overlay — the console's own dialog. */}
      {detail ? (
        <DetailOverlay detail={detail} closeLabel={copy.hudMock.detailClose} onClose={closeDetail} dialogRef={detailRef} />
      ) : null}

      {/* Text chat — the AI Elements overlay, portalled over the console. */}
      {chatOpen ? (
        <SkyChatPanel
          astronaut={selectedAstronaut ? { id: selectedAstronaut.id, name: selectedAstronaut.name } : null}
          docked={chatDock === "right"}
          onClose={() => setChatOpen(false)}
          onReply={(t) => { setPrompt(t.length > 160 ? `${t.slice(0, 157)}…` : t); setAnnouncer(t); }}
          onUiProgram={handleChatProgram}
          onUseVoice={() => {
            // Same as tapping the mic on the console: only start from idle.
            setChatOpen(false);
            if (voiceStatus === "idle") void startVoiceChat();
          }}
        />
      ) : null}

      {/* Chat-composed HUD: one chip back to Sky's own view (never rendered in the watch layout). */}
      {overrideProgram && !isWatch ? (
        <button type="button" className={CHAT_OVERRIDE_CHIP} aria-label={copy.hud.chatOverrideBack} onClick={clearChatOverride}>
          {copy.hud.chatOverrideBack}
        </button>
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
          onClose={astronautId ? () => { setPickerOpen(false); setClaimError(false); } : undefined}
        />
      ) : null}
      <div className="sr-only" role="status" aria-live="polite">{announcer}</div>
    </main>
  );
}
