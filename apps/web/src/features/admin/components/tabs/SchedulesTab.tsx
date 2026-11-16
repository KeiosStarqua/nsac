import { useEffect, useState, type FormEvent } from "react";
import { CalendarClock, Play, Pause, Trash2 } from "lucide-react";
import { format, useCopy } from "~/shared/i18n";
import { ASTRONAUTS } from "~/features/astronaut/model/astronauts";
import {
  listSchedulesFn,
  createScheduledCheckInFn,
  pauseScheduleFn,
  resumeScheduleFn,
  runScheduleFn,
  deleteScheduleFn,
  type ScheduleRow,
} from "../../api/schedules.functions";
import { SCHEDULE_KINDS, defaultPromptFor, type ScheduleKind } from "../../model/schedules-validate";
import { useAdminGate } from "../admin-gate";
import {
  buttonClasses,
  dangerButtonClasses,
  ghostButtonClasses,
  inputClasses,
  labelClasses,
  mono,
  muted,
  sectionCard,
  sectionHeader,
  sectionIcon,
  sectionTitle,
  selectClasses,
  statusDot,
  statusPill,
} from "./classes";

type SaveState = { kind: "ok" | "error"; message: string } | null;

const PRESET_DAILY = "0 7 * * *";
const PRESET_WEEKLY = "0 7 * * 1";

function stamp(ms: number): string {
  return `${new Date(ms).toISOString().replace("T", " ").slice(0, 16)} UTC`;
}

/**
 * `/admin/schedules` — Mastra Schedules threaded into the astronaut chat thread (HARNESSING §19).
 * One fixed agent (`sky-chat`), three kinds, kind-gated `prepare` (a quiet cadence costs zero
 * LLM calls). Scheduled fires never authorize anything: the woken turn runs under the same
 * chat contract (no invented numbers, actions need confirmation).
 */
export function SchedulesTab() {
  const copy = useCopy().admin;
  const { lock } = useAdminGate();

  // Create form
  const [astronautId, setAstronautId] = useState<string>(ASTRONAUTS[0]?.id ?? "ayla-reyes");
  const [kind, setKind] = useState<ScheduleKind>("checkin");
  const [cron, setCron] = useState<string>(PRESET_DAILY);
  const [timezone, setTimezone] = useState<string>("Asia/Ho_Chi_Minh");
  const [name, setName] = useState<string>("");
  const [prompt, setPrompt] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>(null);

  // List
  const [schedules, setSchedules] = useState<ScheduleRow[] | null>(null);
  const [showCompleted, setShowCompleted] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [deleteArmed, setDeleteArmed] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoadFailed(false);
    listSchedulesFn({ data: { includeCompleted: showCompleted } })
      .then((r) => {
        if (cancelled) return;
        if (r.status === "ok") setSchedules(r.schedules);
        else if (r.status === "unauthorized") lock();
        else setLoadFailed(true);
      })
      .catch(() => {
        if (!cancelled) setLoadFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [showCompleted, reloadKey, lock]);

  const reload = () => setReloadKey((n) => n + 1);

  async function submitCreate(e: FormEvent) {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    setSaveState(null);
    try {
      const r = await createScheduledCheckInFn({
        data: {
          astronautId,
          kind,
          cron,
          timezone,
          ...(prompt.trim() ? { prompt } : {}),
          ...(name.trim() ? { name } : {}),
        },
      });
      if (r.status === "ok") {
        setSaveState({ kind: "ok", message: copy.schedulesSaved });
        setPrompt("");
        setName("");
        reload();
      } else if (r.status === "unauthorized") {
        lock();
      } else if (r.status === "unavailable") {
        setSaveState({ kind: "error", message: copy.schedulesUnavailable });
      } else if (r.status === "error") {
        setSaveState({ kind: "error", message: copy.schedulesSaveFailed });
      } else {
        setSaveState({ kind: "error", message: copy.schedulesInvalid });
      }
    } catch {
      setSaveState({ kind: "error", message: copy.schedulesSaveFailed });
    } finally {
      setSaving(false);
    }
  }

  async function act(id: string, action: "run" | "pause" | "resume" | "delete") {
    if (busyId) return;
    if (action === "run" && !window.confirm(copy.schedulesRunConfirm)) return;
    setBusyId(`${action}:${id}`);
    try {
      const fn =
        action === "run" ? runScheduleFn : action === "pause" ? pauseScheduleFn : action === "resume" ? resumeScheduleFn : deleteScheduleFn;
      const r = await fn({ data: { id } });
      if (r.status === "unauthorized") {
        lock();
        return;
      }
      if (action === "delete") setDeleteArmed(null);
      reload();
    } catch {
      reload();
    } finally {
      setBusyId(null);
    }
  }

  const kindLabel = (id: string) =>
    id === "checkin"
      ? copy.schedulesKindCheckin
      : id === "cardio-watchdog"
        ? copy.schedulesKindCardioWatchdog
        : id === "findings-review"
          ? copy.schedulesKindFindingsReview
          : id;
  const kindDescription = (id: ScheduleKind) =>
    id === "checkin"
      ? copy.schedulesKindCheckinDesc
      : id === "cardio-watchdog"
        ? copy.schedulesKindCardioWatchdogDesc
        : copy.schedulesKindFindingsReviewDesc;
  const statusLabel = (status: ScheduleRow["status"]) =>
    status === "active" ? copy.schedulesStatusActive : status === "paused" ? copy.schedulesStatusPaused : copy.schedulesStatusCompleted;

  return (
    <section aria-label={copy.schedulesTitle} className={sectionCard}>
      <div className={sectionHeader}>
        <h2 className={sectionTitle}>
          <CalendarClock aria-hidden className={sectionIcon} strokeWidth={1.75} />
          {copy.schedulesTitle}
        </h2>
        <span className={statusPill("ok")}>
          <span aria-hidden className={statusDot("ok")} />
          sky-chat
        </span>
      </div>
      <p className={`${muted} mt-2 max-w-[68ch] text-[12px] leading-5`}>{copy.schedulesIntro}</p>
      <p className={`${muted} mt-1 text-[12px] leading-5`}>{copy.schedulesAgentFixed}</p>

      {/* Create form */}
      <form onSubmit={submitCreate} className="mt-4 rounded-(--radius-sm)! border border-(--border) bg-(--surface-2) p-3 sm:p-4">
        <h3 className="text-[12px] font-semibold uppercase tracking-[0.14em] text-(--text)">{copy.schedulesCreateTitle}</h3>

        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="schedule-astronaut" className={labelClasses}>{copy.schedulesAstronautLabel}</label>
            <select
              id="schedule-astronaut"
              value={astronautId}
              onChange={(e) => setAstronautId(e.target.value)}
              className={selectClasses}
            >
              {ASTRONAUTS.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name} · {a.role}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="schedule-kind" className={labelClasses}>{copy.schedulesKindLabel}</label>
            <select
              id="schedule-kind"
              value={kind}
              onChange={(e) => setKind(e.target.value as ScheduleKind)}
              className={selectClasses}
            >
              {SCHEDULE_KINDS.map((k) => (
                <option key={k} value={k}>
                  {kindLabel(k)}
                </option>
              ))}
            </select>
          </div>
        </div>
        <p className={`${muted} mt-2 text-[12px] leading-5`}>{kindDescription(kind)}</p>

        <div className="mt-3">
          <span className={labelClasses}>{copy.schedulesCronLabel}</span>
          <div className="flex flex-wrap items-center gap-2">
            {[
              { key: "daily", label: copy.schedulesPresetDaily, value: PRESET_DAILY },
              { key: "weekly", label: copy.schedulesPresetWeekly, value: PRESET_WEEKLY },
              { key: "custom", label: copy.schedulesPresetCustom, value: "" },
            ].map((preset) => (
              <button
                key={preset.key}
                type="button"
                onClick={() => setCron(preset.value)}
                className={`${ghostButtonClasses} px-3! py-1.5! text-[12px]!`}
              >
                {preset.label}
              </button>
            ))}
          </div>
          <input
            id="schedule-cron"
            value={cron}
            onChange={(e) => setCron(e.target.value)}
            spellCheck={false}
            autoComplete="off"
            placeholder="0 7 * * *"
            aria-label={copy.schedulesCronLabel}
            className={`${inputClasses} ${mono} mt-2`}
          />
          <p className={`${muted} mt-1.5 text-[12px] leading-5`}>{copy.schedulesCronHint}</p>
        </div>

        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="schedule-timezone" className={labelClasses}>{copy.schedulesTimezoneLabel}</label>
            <input
              id="schedule-timezone"
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              spellCheck={false}
              autoComplete="off"
              className={`${inputClasses} ${mono}`}
            />
          </div>
          <div>
            <label htmlFor="schedule-name" className={labelClasses}>{copy.schedulesNameLabel}</label>
            <input
              id="schedule-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={120}
              spellCheck={false}
              autoComplete="off"
              placeholder={copy.schedulesNamePlaceholder}
              className={inputClasses}
            />
          </div>
        </div>

        <div className="mt-3">
          <label htmlFor="schedule-prompt" className={labelClasses}>{copy.schedulesPromptLabel}</label>
          <textarea
            id="schedule-prompt"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            maxLength={1000}
            rows={2}
            spellCheck={false}
            autoComplete="off"
            placeholder={defaultPromptFor(kind)}
            className={inputClasses}
          />
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button type="submit" disabled={saving || cron.trim().length === 0} className={buttonClasses}>
            {saving ? copy.schedulesSaving : copy.schedulesSave}
          </button>
          <div aria-live="polite" className="text-[14px]">
            {saveState?.kind === "ok" && <span className="text-(--green)">{saveState.message}</span>}
            {saveState?.kind === "error" && <span className="text-(--red)">{saveState.message}</span>}
          </div>
        </div>
      </form>

      {/* List */}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-[12px] font-semibold uppercase tracking-[0.14em] text-(--text)">{copy.schedulesListTitle}</h3>
        <label className="inline-flex cursor-pointer items-center gap-2 text-[12px] text-(--muted)">
          <input
            type="checkbox"
            checked={showCompleted}
            onChange={(e) => setShowCompleted(e.target.checked)}
            className="accent-(--accent)"
          />
          {copy.schedulesShowCompleted}
        </label>
      </div>

      {loadFailed ? (
        <p className="mt-2 text-[14px] text-(--red)">{copy.schedulesLoadFailed}</p>
      ) : schedules === null ? (
        <p className={`${muted} mt-2 text-[14px]`}>…</p>
      ) : schedules.length === 0 ? (
        <p className={`${muted} mt-2 text-[14px]`}>{copy.schedulesEmpty}</p>
      ) : (
        <ul className="mt-1 divide-y divide-(--border-subtle)">
          {schedules.map((s) => (
            <li key={s.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 py-3">
              <div className="min-w-0 max-w-[64ch]">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={statusPill(s.status === "active" ? "ok" : "mute")}>
                    <span aria-hidden className={statusDot(s.status === "active" ? "ok" : "mute")} />
                    {statusLabel(s.status)}
                  </span>
                  <span className="text-[14px] font-semibold">{s.name ?? kindLabel(s.kind ?? "checkin")}</span>
                  {s.seeded && (
                    <span className="text-[10px] uppercase tracking-[0.18em] text-(--muted)">{copy.schedulesSeeded}</span>
                  )}
                </div>
                <p className={`${muted} mt-1 text-[12px] leading-5`}>
                  {s.astronautId ?? "?"} · <span className={mono}>{s.cron ?? (s.runAt !== null ? `runAt ${stamp(s.runAt)}` : "?")}</span>
                  {s.timezone ? <> · {s.timezone}</> : null} · {kindLabel(s.kind ?? "checkin")}
                </p>
                <p className={`${muted} mt-0.5 text-[11px] leading-4`}>
                  {s.nextFireAt !== null && format(copy.schedulesNextFire, { time: stamp(s.nextFireAt) })}
                  {s.lastFireAt !== null && (
                    <>
                      {s.nextFireAt !== null && " · "}
                      {format(copy.schedulesLastFire, { time: stamp(s.lastFireAt) })}
                    </>
                  )}
                </p>
              </div>
              <div className="flex shrink-0 flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => void act(s.id, "run")}
                  disabled={busyId !== null}
                  className={`${ghostButtonClasses} inline-flex items-center gap-1.5 px-3! py-1.5! text-[12px]!`}
                  aria-label={copy.schedulesRunNow}
                >
                  <Play aria-hidden className="size-3.5" />
                  {copy.schedulesRunNow}
                </button>
                {s.status === "active" ? (
                  <button
                    type="button"
                    onClick={() => void act(s.id, "pause")}
                    disabled={busyId !== null}
                    className={`${ghostButtonClasses} inline-flex items-center gap-1.5 px-3! py-1.5! text-[12px]!`}
                  >
                    <Pause aria-hidden className="size-3.5" />
                    {copy.schedulesPause}
                  </button>
                ) : s.status === "paused" ? (
                  <button
                    type="button"
                    onClick={() => void act(s.id, "resume")}
                    disabled={busyId !== null}
                    className={`${ghostButtonClasses} inline-flex items-center gap-1.5 px-3! py-1.5! text-[12px]!`}
                  >
                    <Play aria-hidden className="size-3.5" />
                    {copy.schedulesResume}
                  </button>
                ) : null}
                {deleteArmed === s.id ? (
                  <span className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => void act(s.id, "delete")}
                      disabled={busyId !== null}
                      className={`${dangerButtonClasses} inline-flex items-center gap-1.5 px-3! py-1.5! text-[12px]!`}
                    >
                      <Trash2 aria-hidden className="size-3.5" />
                      {copy.schedulesDeleteConfirm}
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleteArmed(null)}
                      className={`${ghostButtonClasses} px-3! py-1.5! text-[12px]!`}
                    >
                      {copy.schedulesDeleteCancel}
                    </button>
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => setDeleteArmed(s.id)}
                    disabled={busyId !== null}
                    className={`${dangerButtonClasses} inline-flex items-center gap-1.5 px-3! py-1.5! text-[12px]!`}
                    aria-label={copy.schedulesDelete}
                  >
                    <Trash2 aria-hidden className="size-3.5" />
                    {copy.schedulesDelete}
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
