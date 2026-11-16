import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Check, LoaderCircle, TriangleAlert, X } from "lucide-react";
import { format, useCopy } from "../../../shared/i18n";
import {
  ASTRONAUTS,
  astronautForKey,
  findAstronaut,
  moveSelectionAvailable,
  type Astronaut,
} from "../model/astronauts";
import AstronautAvatar from "./AstronautAvatar";

// Tailwind utilities replacing AstronautPicker.module.css. The picker renders at the app root on `/`
// and inside the watch face on `/watch`; the watch-face sheet keeps the old `:global(.watch-screen)`
// overrides as `[.watch-screen_&]` variants (specificity 0,2,0), so they still win over the ≤480px
// full-screen sheet exactly like the CSS module did.
const BACKDROP = [
  "fixed inset-0 z-[60] grid place-items-center bg-[rgba(7,11,20,.72)] backdrop-blur-[3px] p-[24px]",
  "[.watch-screen_&]:bg-[rgba(4,13,24,.72)] [.watch-screen_&]:p-0 [.watch-screen_&]:backdrop-blur-[3px]",
  "max-[720px]:p-[12px] max-[480px]:bg-[#070b14] max-[480px]:p-0 max-[480px]:backdrop-blur-none",
].join(" ");

const PANEL = [
  "relative max-h-[calc(100dvh_-_48px)] w-[min(1240px,96vw)] overflow-y-auto rounded-[16px]! border",
  "border-[#1e293b] bg-[rgba(15,22,38,.92)] p-[28px_28px_22px] text-[#e7edf7] backdrop-blur-[16px]",
  "shadow-[0_20px_60px_-20px_rgba(0,0,0,.6)]",
  "focus:outline-none focus-visible:[outline:2px_solid_#f5fcff]! focus-visible:outline-offset-[4px]!",
  "[.watch-screen_&]:flex [.watch-screen_&]:h-full [.watch-screen_&]:max-h-none [.watch-screen_&]:w-full [.watch-screen_&]:flex-col [.watch-screen_&]:overflow-y-auto",
  "[.watch-screen_&]:rounded-none! [.watch-screen_&]:border-0 [.watch-screen_&]:bg-[rgba(9,15,27,.96)] [.watch-screen_&]:p-[10px_10px_8px]",
  "max-[720px]:p-[22px_16px_18px]",
  "max-[480px]:flex max-[480px]:h-dvh max-[480px]:max-h-dvh max-[480px]:w-screen max-[480px]:flex-col max-[480px]:overflow-y-auto",
  "max-[480px]:rounded-none! max-[480px]:border-0 max-[480px]:bg-[rgba(9,15,27,.97)]",
  "max-[480px]:pt-[calc(env(safe-area-inset-top,0px)_+_10px)] max-[480px]:pr-[12px] max-[480px]:pb-[calc(env(safe-area-inset-bottom,0px)_+_10px)] max-[480px]:pl-[12px]",
].join(" ");

const CLOSE = [
  "absolute right-[16px] top-[14px] grid size-[32px] cursor-pointer place-items-center rounded-full! border",
  "border-[#1e293b] bg-[rgba(7,11,20,.7)] text-[#98a6bd]",
  "hover:border-[#5eead4] hover:text-[#5eead4]",
  "focus-visible:outline-2! focus-visible:outline-offset-[5px]! focus-visible:outline-[#f5fcff]!",
  "[.watch-screen_&]:right-[6px] [.watch-screen_&]:top-[6px] [.watch-screen_&]:size-[30px]",
  "max-[480px]:right-[10px] max-[480px]:top-[calc(env(safe-area-inset-top,0px)_+_8px)] max-[480px]:size-[44px]",
].join(" ");

const HEADER = "mb-[22px] text-center [.watch-screen_&]:mb-[6px] max-[480px]:mb-[12px]";

const PILL = [
  "inline-flex items-center gap-[6px] rounded-[4px] border border-[#1e293b] bg-[rgba(7,11,20,.6)] px-[10px] py-[2px]",
  "font-mono text-[11px] tracking-[.18em] text-[#5eead4]",
  "before:h-[6px] before:w-[6px] before:rounded-full before:bg-[#5eead4] before:content-['']",
  "[.watch-screen_&]:px-[7px] [.watch-screen_&]:py-[1px] [.watch-screen_&]:text-[7px]",
].join(" ");

const TITLE = [
  "mt-[8px]! mb-[4px]! text-[22px] font-light",
  "[.watch-screen_&]:mt-[4px]! [.watch-screen_&]:mb-[2px]! [.watch-screen_&]:text-[15px]",
  "max-[480px]:text-[19px]",
].join(" ");

const SUBTITLE = "text-[14px] text-[#98a6bd] [.watch-screen_&]:text-[9.5px] max-[480px]:text-[12px]";

const RAIL = [
  "mx-[-4px] mb-[20px] flex snap-x snap-proximity flex-nowrap gap-[12px] overflow-x-auto px-[4px] pt-[4px] pb-[10px]",
  "[scrollbar-color:#28404b_transparent] [scrollbar-width:thin]",
  "[.watch-screen_&]:mx-0 [.watch-screen_&]:mb-[8px] [.watch-screen_&]:flex-col [.watch-screen_&]:gap-[6px] [.watch-screen_&]:overflow-x-visible [.watch-screen_&]:p-0 [.watch-screen_&]:[scroll-snap-type:none] [.watch-screen_&]:[scrollbar-width:none] [.watch-screen_&]:[&::-webkit-scrollbar]:hidden",
  "max-[480px]:mx-0 max-[480px]:mb-[12px] max-[480px]:flex-col max-[480px]:gap-[8px] max-[480px]:overflow-x-visible max-[480px]:p-0 max-[480px]:[scroll-snap-type:none] max-[480px]:[scrollbar-width:none] max-[480px]:[&::-webkit-scrollbar]:hidden",
].join(" ");

const CARD = [
  "flex min-h-[236px] flex-[1_0_172px] max-w-[220px] cursor-pointer snap-center flex-col gap-[8px] rounded-[12px]! border",
  "border-[#1e293b] bg-[rgba(10,16,28,.55)] p-[16px_14px] text-left text-[#e7edf7]",
  "[transition:border-color_.18s,box-shadow_.18s,opacity_.18s,transform_.18s]",
  "focus-visible:opacity-100 focus-visible:outline-2! focus-visible:outline-offset-[2px]! focus-visible:outline-[#e7edf7]!",
  "motion-reduce:hover:[transform:none]",
  "[.watch-screen_&]:grid [.watch-screen_&]:flex-none [.watch-screen_&]:min-h-[40px] [.watch-screen_&]:w-full [.watch-screen_&]:max-w-none [.watch-screen_&]:[column-gap:10px] [.watch-screen_&]:items-center [.watch-screen_&]:p-[5px_8px] [.watch-screen_&]:[scroll-snap-align:none] [.watch-screen_&]:[grid-template-columns:auto_minmax(0,1fr)_auto] [.watch-screen_&]:[grid-template-areas:'avatar_name_badge'_'avatar_role_badge']",
  "max-[720px]:min-h-[220px] max-[720px]:basis-[150px]",
  "max-[480px]:grid max-[480px]:w-full max-[480px]:max-w-none max-[480px]:flex-none max-[480px]:min-h-[56px] max-[480px]:items-center max-[480px]:p-[8px_12px] max-[480px]:[column-gap:12px] max-[480px]:[scroll-snap-align:none] max-[480px]:[grid-template-columns:auto_minmax(0,1fr)_auto] max-[480px]:[grid-template-areas:'avatar_name_badge'_'avatar_role_badge']",
].join(" ");

const CARD_DIM = "opacity-[.62] hover:border-[#98a6bd] hover:opacity-100 hover:[transform:translateY(-2px)]";
const CARD_SELECTED = [
  "border-[#5eead4] opacity-100 shadow-[inset_0_0_20px_0_rgba(94,234,212,.06),0_0_32px_-8px_rgba(94,234,212,.35)]",
  "hover:border-[#5eead4] hover:opacity-100 hover:[transform:translateY(-2px)]",
].join(" ");
const CARD_TAKEN =
  "cursor-not-allowed border-dashed opacity-[.45] hover:border-[#1e293b] hover:opacity-[.45] hover:[transform:none]";
const CARD_SELECTED_AND_TAKEN = "border-[#5eead4]";

const CALLSIGN_ROW = "flex items-center justify-between max-[480px]:hidden [.watch-screen_&]:hidden";

const CALLSIGN = "rounded-[4px] border px-[8px] py-[2px] font-mono text-[11px]";
const CALLSIGN_ACCENT = "border-[rgba(94,234,212,.4)] bg-[rgba(94,234,212,.1)] text-[#5eead4]";
const CALLSIGN_MUTED = "border-[#1e293b] bg-transparent text-[#98a6bd]";

const KEY = "min-w-[18px] rounded-[3px] border border-[#28404b] px-[5px] py-[1px] text-center font-mono text-[10px] text-[#98a6bd]";

const AVATAR = [
  "relative mx-auto my-[6px] grid size-[64px] place-items-center rounded-full border bg-[rgba(7,11,20,.8)]",
  "[.watch-screen_&]:m-0 [.watch-screen_&]:size-[30px] [.watch-screen_&]:[grid-area:avatar]",
  "max-[480px]:m-0 max-[480px]:size-[44px] max-[480px]:[grid-area:avatar]",
].join(" ");
const AVATAR_IDLE = "border-[#1e293b]";
const AVATAR_SELECTED = "border-[#5eead4] shadow-[0_0_28px_-4px_rgba(94,234,212,.35)]";

const INITIAL = "text-[19px] font-semibold tracking-[.08em] [.watch-screen_&]:text-[11px] max-[480px]:text-[15px]";

const CHECK =
  "absolute -right-[6px] -top-[6px] grid size-[22px] place-items-center rounded-full border border-[#5eead4] bg-[rgba(94,234,212,.15)] text-[#5eead4] [.watch-screen_&]:-right-[5px] [.watch-screen_&]:-top-[5px] [.watch-screen_&]:size-[16px] max-[480px]:size-[20px]";
const CHECK_ICON = "size-[13px] [.watch-screen_&]:size-[9px] max-[480px]:size-[11px]";

const NAME = [
  "text-center text-[15px] font-semibold",
  "[.watch-screen_&]:min-w-0 [.watch-screen_&]:overflow-hidden [.watch-screen_&]:text-ellipsis [.watch-screen_&]:whitespace-nowrap [.watch-screen_&]:text-left [.watch-screen_&]:text-[12px] [.watch-screen_&]:[align-self:end] [.watch-screen_&]:[grid-area:name]",
  "max-[480px]:min-w-0 max-[480px]:overflow-hidden max-[480px]:text-ellipsis max-[480px]:whitespace-nowrap max-[480px]:text-left max-[480px]:text-[17px] max-[480px]:[align-self:end] max-[480px]:[grid-area:name]",
].join(" ");

const ROLE = [
  "text-center text-[12px]",
  "[.watch-screen_&]:min-w-0 [.watch-screen_&]:overflow-hidden [.watch-screen_&]:text-ellipsis [.watch-screen_&]:whitespace-nowrap [.watch-screen_&]:text-left [.watch-screen_&]:text-[8.5px] [.watch-screen_&]:[align-self:start] [.watch-screen_&]:[grid-area:role]",
  "max-[480px]:min-w-0 max-[480px]:overflow-hidden max-[480px]:text-ellipsis max-[480px]:whitespace-nowrap max-[480px]:text-left max-[480px]:text-[11px] max-[480px]:[align-self:start] max-[480px]:[grid-area:role]",
].join(" ");

const STATUS = [
  "mt-auto flex items-center justify-center gap-[6px] border-t border-[#1e293b] pt-[10px] text-center",
  "font-mono text-[10px] text-[#98a6bd]",
  "before:h-[6px] before:w-[6px] before:flex-none before:rounded-full before:content-['']",
  "max-[480px]:hidden [.watch-screen_&]:hidden",
].join(" ");
const STATUS_DOT_IDLE = "before:bg-[#5eead4]";
const STATUS_DOT_DIM = "before:bg-[#7f9db4]";

const TAKEN_BADGE = [
  "mt-auto flex items-center justify-center gap-[6px] border-t border-[#1e293b] pt-[10px] text-center",
  "font-mono text-[10px] tracking-[.12em] text-[#fca5a5]",
  "before:h-[6px] before:w-[6px] before:flex-none before:rounded-full before:bg-[#fca5a5] before:content-['']",
  "[.watch-screen_&]:m-0 [.watch-screen_&]:max-w-[92px] [.watch-screen_&]:overflow-hidden [.watch-screen_&]:text-ellipsis [.watch-screen_&]:whitespace-nowrap [.watch-screen_&]:rounded-full [.watch-screen_&]:border [.watch-screen_&]:border-[rgba(252,165,165,.45)] [.watch-screen_&]:p-[3px_6px] [.watch-screen_&]:text-[7px] [.watch-screen_&]:tracking-[.08em] [.watch-screen_&]:[grid-area:badge] [.watch-screen_&]:before:size-[4px]",
  "max-[480px]:m-0 max-[480px]:max-w-[128px] max-[480px]:overflow-hidden max-[480px]:text-ellipsis max-[480px]:whitespace-nowrap max-[480px]:rounded-full max-[480px]:border max-[480px]:border-[rgba(252,165,165,.45)] max-[480px]:p-[4px_8px] max-[480px]:text-[8px] max-[480px]:tracking-[.1em] max-[480px]:[grid-area:badge] max-[480px]:before:size-[5px]",
].join(" ");

const CONFIRM = [
  "mx-auto mb-[8px] block w-full max-w-[360px] cursor-pointer rounded-[10px]! border-0 p-[12px]",
  "bg-[#5eead4] text-[14px]! font-semibold! text-[#041018] shadow-[0_0_24px_0_rgba(94,234,212,.35)]",
  "hover:bg-[#7ff0dd]",
  "disabled:cursor-not-allowed disabled:bg-[#334155] disabled:text-[#94a3b8] disabled:opacity-[.45] disabled:shadow-none disabled:hover:bg-[#334155]",
  "focus-visible:outline-2! focus-visible:outline-offset-[3px]! focus-visible:outline-[#e7edf7]!",
  "[.watch-screen_&]:sticky [.watch-screen_&]:bottom-0 [.watch-screen_&]:mt-auto [.watch-screen_&]:min-h-[36px] [.watch-screen_&]:max-w-none [.watch-screen_&]:p-[8px] [.watch-screen_&]:text-[11px]!",
  "max-[480px]:sticky max-[480px]:bottom-0 max-[480px]:mt-auto max-[480px]:min-h-[48px] max-[480px]:max-w-none max-[480px]:p-[13px] max-[480px]:text-[15px]!",
].join(" ");

const ERROR = [
  "mx-auto mb-[10px]! max-w-[420px] rounded-[6px] border border-[rgba(252,165,165,.35)] bg-[rgba(252,165,165,.08)]",
  "px-[10px] py-[8px] text-center text-[12px] text-[#fca5a5]",
  "[.watch-screen_&]:mx-0 [.watch-screen_&]:mb-[6px]! [.watch-screen_&]:max-w-none [.watch-screen_&]:px-[8px] [.watch-screen_&]:py-[5px] [.watch-screen_&]:text-[9px]",
  "max-[480px]:mx-0 max-[480px]:mb-[8px]! max-[480px]:max-w-none",
].join(" ");

const HINT =
  "mb-[8px]! text-center font-mono text-[11px] text-[#98a6bd] [.watch-screen_&]:mb-[4px]! [.watch-screen_&]:text-[8px] max-[480px]:mb-[6px]! max-[480px]:text-[10px]";

const FOOTER = "text-center text-[12px] text-[rgba(152,166,189,.9)] [.watch-screen_&]:text-[8px] max-[480px]:text-[10px]";

// Force release: tertiary text button (never the primary CONFIRM look), its 2-step inline confirm
// row and the failure line. Muted by default, warms to a warning tint on hover/focus.
const FORCE_RELEASE = [
  "mx-auto mb-[10px] flex cursor-pointer items-center justify-center gap-[6px] rounded-[10px]! border-0 bg-transparent p-[4px_6px]",
  "text-[11px] uppercase tracking-[.12em] text-[#98a6bd] hover:text-[#ffd9d0]",
  "focus-visible:outline-2! focus-visible:outline-offset-[3px]! focus-visible:outline-[#e7edf7]!",
  "[.watch-screen_&]:mb-[6px] [.watch-screen_&]:text-[8px] max-[480px]:mb-[8px] max-[480px]:text-[10px]",
].join(" ");

const FORCE_CONFIRM_ROW = [
  "mx-auto mb-[10px]! max-w-[440px] rounded-[6px] border border-[rgba(252,165,165,.35)] bg-[rgba(252,165,165,.08)]",
  "px-[10px] py-[8px] text-center",
  "[.watch-screen_&]:mx-0 [.watch-screen_&]:mb-[6px]! [.watch-screen_&]:max-w-none [.watch-screen_&]:px-[8px] [.watch-screen_&]:py-[5px]",
  "max-[480px]:mx-0 max-[480px]:mb-[8px]! max-[480px]:max-w-none",
].join(" ");

const FORCE_CONFIRM_TEXT = "m-0 text-[12px] text-[#fca5a5] [.watch-screen_&]:text-[9px] max-[480px]:text-[11px]";

const FORCE_CONFIRM_ACTIONS = "mt-[8px] flex items-center justify-center gap-[8px] [.watch-screen_&]:mt-[5px]";

const FORCE_CONFIRM_ACTION = [
  "cursor-pointer rounded-[10px]! border border-[rgba(252,165,165,.55)] bg-[rgba(252,165,165,.12)]",
  "p-[6px_12px] text-[11px]! font-semibold! text-[#fecaca] hover:border-[#fca5a5] hover:bg-[rgba(252,165,165,.2)]",
  "disabled:cursor-not-allowed disabled:opacity-[.5]",
  "focus-visible:outline-2! focus-visible:outline-offset-[2px]! focus-visible:outline-[#e7edf7]!",
  "[.watch-screen_&]:p-[4px_8px] [.watch-screen_&]:text-[8px]! max-[480px]:p-[9px_14px] max-[480px]:text-[12px]!",
].join(" ");

const FORCE_CANCEL = [
  "cursor-pointer rounded-[10px]! border border-[#1e293b] bg-transparent p-[6px_12px]",
  "text-[11px]! text-[#98a6bd] hover:border-[#5eead4] hover:text-[#5eead4]",
  "disabled:cursor-not-allowed disabled:opacity-[.5]",
  "focus-visible:outline-2! focus-visible:outline-offset-[2px]! focus-visible:outline-[#e7edf7]!",
  "[.watch-screen_&]:p-[4px_8px] [.watch-screen_&]:text-[8px]! max-[480px]:p-[9px_14px] max-[480px]:text-[12px]!",
].join(" ");

const FORCE_ERROR =
  "mx-auto mb-[8px]! max-w-[440px] text-center text-[11px] text-[#fca5a5] [.watch-screen_&]:mb-[5px]! [.watch-screen_&]:text-[8px] max-[480px]:mb-[6px]! max-[480px]:text-[10px]";

interface Props {
  /** Rendered by the parent only when the picker should be visible. */
  readonly open: boolean;
  /** Roster from the backend; the bundled fixture is used when absent or empty. */
  readonly roster?: readonly Astronaut[];
  /** Currently saved crew member, so reopening pre-selects it. */
  readonly initialId?: string | null;
  /** Crew ids held by *other* sessions. My own claim must be in `mineId`, not here. */
  readonly takenIds?: ReadonlySet<string>;
  /** Crew id this session currently holds; stays selectable even when `takenIds` is stale. */
  readonly mineId?: string | null;
  /** A claim request is in flight — every confirm/double-click is locked out. */
  readonly claiming?: boolean;
  /** Inline error under the rail (e.g. someone else just took the selected card). */
  readonly error?: string | null;
  readonly onSelect: (id: string) => void;
  /** Omitted on the first visit: there is no valid state to return to yet. */
  readonly onClose?: () => void;
  /**
   * Force-release every pick (demo escape hatch when the crew is full and a new user cannot
   * join). Rendered only when some crew member is currently claimed by someone else.
   */
  readonly onForceRelease?: () => Promise<{ ok: boolean; cleared?: number; epoch?: number }>;
  /** Called after a successful `onForceRelease` so the parent can refresh its claim list. */
  readonly onReleased?: (epoch?: number) => void;
}

function isTypingTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el) return false;
  const tag = el.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || el.isContentEditable;
}

export function AstronautPicker({ open, roster, initialId, takenIds, mineId, claiming = false, error, onSelect, onClose, onForceRelease, onReleased }: Props) {
  const copy = useCopy();
  const crew = roster && roster.length > 0 ? roster : ASTRONAUTS;
  const isTaken = useCallback(
    (id: string) => (takenIds?.has(id) ?? false) && id !== mineId,
    [takenIds, mineId],
  );
  const defaultId = useMemo(
    () => findAstronaut(initialId, crew)?.id ?? crew[0]?.id ?? "",
    [initialId, crew],
  );
  const [selected, setSelected] = useState<string>(defaultId);
  const [forceConfirming, setForceConfirming] = useState(false);
  const [forceBusy, setForceBusy] = useState(false);
  const [forceFailed, setForceFailed] = useState(false);
  const panelRef = useRef<HTMLElement | null>(null);
  const returnFocusRef = useRef<Element | null>(null);
  const cardRefs = useRef(new Map<string, HTMLButtonElement>());

  // Reset to the saved astronaut (or Ayla) each time the dialog opens, and drop any half-finished
  // force-release confirm so reopening never shows a stale confirm row.
  useEffect(() => {
    if (open) setSelected(defaultId);
  }, [open, defaultId]);
  useEffect(() => {
    if (!open) {
      setForceConfirming(false);
      setForceBusy(false);
      setForceFailed(false);
    }
  }, [open]);

  // Keep the selection valid when the API roster replaces the fixture.
  useEffect(() => {
    if (!crew.some((a) => a.id === selected)) setSelected(defaultId);
  }, [crew, selected, defaultId]);

  // Move focus into the dialog and scroll the active card into view.
  useEffect(() => {
    if (!open) return;
    returnFocusRef.current = document.activeElement;
    panelRef.current?.focus();
    return () => {
      (returnFocusRef.current as HTMLElement | null)?.focus?.();
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    cardRefs.current.get(selected)?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [open, selected]);

  const taken = useMemo(() => {
    const s = new Set(takenIds ?? []);
    if (mineId) s.delete(mineId);
    return s;
  }, [takenIds, mineId]);
  // Confirm is only legal for an available selection with no claim in flight.
  const selectionTaken = isTaken(selected);
  const canConfirm = !claiming && !selectionTaken && selected.length > 0;

  const confirm = useCallback(
    (id: string) => {
      if (!id || claiming) return;
      if (isTaken(id)) return;
      onSelect(id);
    },
    [claiming, isTaken, onSelect],
  );

  // Force release (demo escape hatch): the confirm row is inline, so nothing runs on the first tap.
  const showForceRelease = !!onForceRelease && taken.size > 0;
  const runForceRelease = useCallback(async () => {
    if (!onForceRelease || forceBusy) return;
    setForceBusy(true);
    setForceFailed(false);
    try {
      const res = await onForceRelease();
      if (res?.ok) {
        setForceConfirming(false);
        setForceFailed(false);
        onReleased?.(res.epoch);
      } else {
        setForceFailed(true);
      }
    } catch {
      setForceFailed(true);
    } finally {
      setForceBusy(false);
    }
  }, [onForceRelease, onReleased, forceBusy]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) return;
      if (isTypingTarget(event.target)) return;
      // Let the explicit close control handle its own activation.
      if ((event.target as HTMLElement | null)?.closest?.("[data-picker-close]")) return;
      // Same for the force-release row: real buttons, native Enter/Space activation must win over
      // the picker-wide Enter = confirm shortcut.
      if ((event.target as HTMLElement | null)?.closest?.("[data-force-release]")) return;

      if (event.key === "Enter") {
        event.preventDefault();
        confirm(selected);
        return;
      }
      if (event.key === "Escape" && onClose) {
        event.preventDefault();
        onClose();
        return;
      }

      const byDigit = astronautForKey(event.key, crew);
      if (byDigit) {
        event.preventDefault();
        if (!isTaken(byDigit.id)) setSelected(byDigit.id);
        return;
      }

      if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
        const next = moveSelectionAvailable(crew, taken, selected, event.key === "ArrowLeft" ? -1 : 1);
        if (next) {
          event.preventDefault();
          setSelected(next.id);
        }
        return;
      }
      if (event.key === "Home" || event.key === "End") {
        const available = crew.filter((a) => !isTaken(a.id));
        const next = event.key === "Home" ? available[0] : available[available.length - 1];
        if (next) {
          event.preventDefault();
          setSelected(next.id);
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, selected, crew, taken, isTaken, confirm, onClose]);

  if (!open) return null;

  const chosen = findAstronaut(selected, crew) ?? crew[0];
  if (!chosen) return null;

  return (
    <div className={BACKDROP} role="presentation">
      <section
        className={PANEL}
        role="dialog"
        aria-modal="true"
        aria-labelledby="astronaut-picker-title"
        aria-describedby="astronaut-picker-subtitle"
        tabIndex={-1}
        ref={panelRef}
      >
        {onClose ? (
          <button
            type="button"
            className={CLOSE}
            aria-label={copy.astronaut.close}
            data-picker-close
            onClick={onClose}
          >
            <X aria-hidden="true" strokeWidth={2} className="size-[16px] [.watch-screen_&]:size-[14px] max-[480px]:size-[20px]" />
          </button>
        ) : null}

        <div className={HEADER}>
          <span className={PILL}>{copy.astronaut.eyebrow}</span>
          <h2 id="astronaut-picker-title" className={TITLE}>{copy.astronaut.title}</h2>
          <p id="astronaut-picker-subtitle" className={SUBTITLE}>{copy.astronaut.subtitle}</p>
        </div>

        <div className={RAIL} role="radiogroup" aria-labelledby="astronaut-picker-title">
          {crew.map((a, index) => {
            const isSelected = selected === a.id;
            const cardTaken = isTaken(a.id);
            const cardClass = [
              CARD,
              cardTaken ? CARD_TAKEN : isSelected ? CARD_SELECTED : CARD_DIM,
              cardTaken && isSelected ? CARD_SELECTED_AND_TAKEN : "",
            ].filter(Boolean).join(" ");
            return (
              <button
                key={a.id}
                type="button"
                role="radio"
                aria-checked={isSelected}
                aria-disabled={cardTaken || undefined}
                disabled={cardTaken}
                className={cardClass}
                onClick={() => { if (!cardTaken) setSelected(a.id); }}
                onDoubleClick={() => confirm(a.id)}
                ref={(node) => {
                  if (node) cardRefs.current.set(a.id, node);
                  else cardRefs.current.delete(a.id);
                }}
              >
                <span className={CALLSIGN_ROW}>
                  <span className={`${CALLSIGN} ${isSelected && !cardTaken ? CALLSIGN_ACCENT : CALLSIGN_MUTED}`}>{a.callsign}</span>
                  {cardTaken ? null : <kbd className={KEY} aria-hidden="true">{index + 1}</kbd>}
                </span>
                <span className={`${AVATAR} ${isSelected ? AVATAR_SELECTED : AVATAR_IDLE}`}>
                  {/* Portrait fills the circle; the initials fallback keeps the exact old glyph. */}
                  <AstronautAvatar
                    astronaut={a}
                    className="size-full"
                    initialsClassName={`${INITIAL} ${isSelected ? "text-[#5eead4]" : "text-[#98a6bd]"}`}
                  />
                  {isSelected ? <span className={CHECK} aria-hidden="true"><Check strokeWidth={3.25} className={CHECK_ICON} /></span> : null}
                </span>
                <span className={NAME}>{a.name}</span>
                <span className={`${ROLE} ${isSelected ? "text-[#5eead4]" : "text-[#98a6bd]"}`}>{a.role}</span>
                {cardTaken ? (
                  <span className={TAKEN_BADGE}>{copy.astronaut.taken}</span>
                ) : (
                  <span className={`${STATUS} ${isSelected ? STATUS_DOT_IDLE : STATUS_DOT_DIM}`}>{copy.astronaut.status}</span>
                )}
              </button>
            );
          })}
        </div>

        {error ? (
          <p className={ERROR} role="alert">{error}</p>
        ) : null}
        <button
          type="button"
          className={CONFIRM}
          disabled={!canConfirm}
          onClick={() => confirm(chosen.id)}
        >
          {claiming
            ? copy.astronaut.claiming
            : selectionTaken
              ? copy.astronaut.takenCta
              : format(copy.astronaut.confirm, { name: chosen.name })}
        </button>
        <p className={HINT}>{copy.astronaut.hint}</p>
        {showForceRelease ? (
          forceConfirming ? (
            <div className={FORCE_CONFIRM_ROW} data-force-release>
              <p className={FORCE_CONFIRM_TEXT}>{copy.astronaut.forceReleaseConfirm}</p>
              <div className={FORCE_CONFIRM_ACTIONS}>
                <button
                  type="button"
                  className={FORCE_CONFIRM_ACTION}
                  disabled={forceBusy}
                  onClick={() => void runForceRelease()}
                >
                  {forceBusy ? (
                    <span className="inline-flex items-center gap-[6px]">
                      <LoaderCircle aria-hidden="true" size={12} className="animate-spin" />
                      {copy.astronaut.claiming}
                    </span>
                  ) : (
                    copy.astronaut.forceReleaseConfirmAction
                  )}
                </button>
                <button
                  type="button"
                  className={FORCE_CANCEL}
                  disabled={forceBusy}
                  onClick={() => {
                    setForceConfirming(false);
                    setForceFailed(false);
                  }}
                >
                  {copy.astronaut.forceReleaseCancel}
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              className={FORCE_RELEASE}
              data-force-release
              onClick={() => {
                setForceFailed(false);
                setForceConfirming(true);
              }}
            >
              <TriangleAlert aria-hidden="true" size={13} />
              {copy.astronaut.forceRelease}
            </button>
          )
        ) : null}
        {forceFailed ? (
          <p className={FORCE_ERROR} role="alert">{copy.astronaut.forceReleaseFailed}</p>
        ) : null}
        <p className={FOOTER}>{copy.astronaut.footer}</p>
      </section>
    </div>
  );
}
