// `/watch` — the smartwatch device: the live WatchHud plus its overlays (picker, chat, detail)
// clipped inside the glass face of the AI-generated mockup, on every viewport.
//
// Extracted from the retired staged console (`SkyScreen`, removed 2026-11-16) so the watch keeps
// its own screen: `/` is the declarative OpenUI console in `features/hud-gen`, `/watch` is this one. Behaviour is unchanged — the same backdrop, DOM, copy, claims/picker flow,
// legacy in-face `ChatPanel` and voice state machine the route shipped with.
import { useCallback, useEffect, useRef, useState } from "react";
import { useMounted } from "../../../shared/hooks/useMounted";
import { useReducedMotion } from "motion/react";
import Topography from "../../../shared/react-bits/Topography/Topography";
import {
  DETAIL_ACTION,
  DETAIL_CLOSE,
  DETAIL_EYEBROW,
  DETAIL_FOOTER,
  DETAIL_GLASS,
  DETAIL_MESSAGE,
  DETAIL_OVERLAY,
  DETAIL_VALUE,
  DEVICE_SWITCHER_FLOAT,
  SKY_APP,
  SPACE_VIGNETTE,
  WATCH_CAPTION,
  WATCH_DEVICE,
  WATCH_FRAME,
  WATCH_SCREEN,
  WATCH_STAGE,
} from "../hud-classes";
import { useSkyVoice } from "../useSkyVoice";
import { PHASE_TEXT } from "../voiceCopy";
import { DETAILS, VITAL_DETAILS } from "../vitals";
import {
  AstronautPicker,
  ASTRONAUT_STORAGE_KEY,
  ASTRONAUTS,
  CLAIMS_EPOCH_STORAGE_KEY,
  claimAstronaut,
  findAstronaut,
  firstName,
  getAstronauts,
  getOrCreateSessionId,
  listClaims,
  normalizeAstronautId,
  releaseAllClaims,
  takenIdsOf,
  useClaimHeartbeat,
} from "../../astronaut";
import type { ClaimEntry } from "../../astronaut";
import { useCopy } from "../../../shared/i18n";
import { ChatPanel } from "./ChatPanel";
import { DeviceSwitcher } from "./DeviceSwitcher";
import { WatchHud } from "./WatchHud";

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
 * `/watch` — the live watch HUD framed by the AI-generated smartwatch mockup. The `<Topography>`
 * backdrop is watch-only (the console's backdrop is admin-configured), and the picker, detail
 * dialog and legacy chat panel render inside `.watch-screen` so they clip to the glass.
 */
export function WatchScreen() {
  const copy = useCopy();
  const [hint, setHint] = useState(PHASE_TEXT.idle);
  const mounted = useMounted();
  const [detail, setDetail] = useState<DetailDialogProps | null>(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [astronautId, setAstronautId] = useState<string | null>(null);
  const [roster, setRoster] = useState(() => [...ASTRONAUTS]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [claims, setClaims] = useState<ClaimEntry[]>([]);
  const [claiming, setClaiming] = useState(false);
  const [claimError, setClaimError] = useState(false);
  const sessionIdRef = useRef<string | null>(null);
  const [announcer, setAnnouncer] = useState("");

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

  const reduce = useReducedMotion();
  const fx = mounted && !reduce;

  const detailRef = useRef<HTMLDivElement | null>(null);
  const previousFocus = useRef<Element | null>(null);

  const { phase, energyRef, toggle, readEnergy } = useSkyVoice((next) => setHint(PHASE_TEXT[next]));

  // Claim TTL: đập heartbeat mỗi 30 s khi tab visible để claim không bị backend giải phóng sau
  // 30 phút idle (no-op khi SSR).
  useClaimHeartbeat();

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

  // Crew claims (ai đã giữ astronaut nào). Backend unreachable → claims tắt, picker chạy y như
  // trước (local pick, không enforce): demo không bao giờ bị chặn vì box lỗi.
  const refreshClaims = useCallback(async (sid: string) => {
    try {
      const res = await listClaims({ data: { sessionId: sid } });
      setClaims(Array.isArray(res?.claims) ? res.claims : []);
    } catch {
      /* unreachable → keep the local pick */
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
        // Pre-HUD gate: localStorage giữ astronaut mà claims nói đã bị session KHÁC giữ → xóa và mở
        // picker. Claims unreachable → giữ nguyên hành vi cũ (tin localStorage).
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
              setPickerOpen(true);
            } else if (normalized) {
              // Quay lại sau một thời gian idle: claim cũ có thể đã bị TTL giải phóng. Còn trống →
              // claim lại im lặng; thua race với session khác → cùng đường đi như takenByOther.
              void claimAstronaut({ data: { sessionId: sid, astronautId: normalized } })
                .then((claimed) => {
                  if (!alive || claimed.ok) {
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
        /* keep the local pick */
      });
    return () => {
      alive = false;
    };
  }, [mounted]);

  // One rAF loop feeds the waveform; the mic bar reads energyRef directly per frame.
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
        // Backend không reach được → y như local pick (không enforce).
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
  }, [roster, persistLocalPick, refreshClaims]);

  /**
   * Force release (picker escape hatch): gỡ mọi claim rồi làm mới danh sách. Pick của chính mình
   * cũng bị gỡ — epoch vừa bump nên ghi luôn epoch mới vào localStorage để mount gate không kick
   * thêm lần nữa; picker vẫn mở để chọn lại.
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

  const selectedAstronaut = findAstronaut(astronautId, roster);

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

  // Detail overlay / chat panel / picker — rendered inside `.watch-screen` so they clip to the face.
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

  // `/watch` keeps the compact legacy ChatPanel inside the watch face (it is sized for the glass).
  const chatPanel = chatOpen ? (
    <ChatPanel
      astronaut={selectedAstronaut ? { id: selectedAstronaut.id, name: selectedAstronaut.name } : null}
      onClose={() => setChatOpen(false)}
      onReply={(t) => setAnnouncer(t)}
    />
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

  return (
    <main className={SKY_APP} data-phase={phase} aria-label="SKY astronaut wellness overview">
      {/* /watch always renders the vendored Topography behind the watch device: deep-navy page, dim
          cyan topographic lines, low speed, opacity <= 0.9 — the watch frame stays the focal point. */}
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
      <div className={SPACE_VIGNETTE} aria-hidden="true" />

      {/* /watch IS the watch device: the live WatchHud + overlays (picker, chat, detail) clip inside
          the glass face of the AI-generated mockup on every viewport. */}
      <div className={WATCH_STAGE}>
        <div className={WATCH_DEVICE} role="group" aria-label={copy.hud.watchCaption}>
          <div className={WATCH_SCREEN}>
            {watchHud}
            {detailOverlay}
            {chatPanel}
            {picker}
          </div>
          <img className={WATCH_FRAME} src="/watch/mockup-futuristic-space-gray.png" alt="" aria-hidden="true" draggable={false} />
        </div>
        <p className={WATCH_CAPTION}>{copy.hud.watchCaption}</p>
      </div>
      {/* Floating Console | Watch chip — pinned top-right; hidden ≤480px (phone is watch-only). */}
      <DeviceSwitcher current="watch" className={DEVICE_SWITCHER_FLOAT} />
      <div className="sr-only" role="status" aria-live="polite">{announcer}</div>
    </main>
  );
}
