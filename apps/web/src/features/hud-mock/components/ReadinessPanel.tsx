import type { CSSProperties, ReactNode } from "react";
import { useState } from "react";
import {
  Activity,
  Bone,
  Calculator,
  Dumbbell,
  Eye,
  Flame,
  Footprints,
  HeartPulse,
  Moon,
  Percent,
  Smile,
  Timer,
  Utensils,
  Weight,
  Zap,
  Bed,
} from "lucide-react";
import type { Copy } from "~/shared/i18n";
import { format } from "~/shared/i18n";
import { signedKcal, type HudMockFixture } from "../model/fixture";
import {
  buildPanels,
  groupThousands,
  TAB_IDS,
  type PanelRow,
  type RowId,
  type TabId,
} from "../model/panels";
import {
  CARD,
  CARD_HEAD,
  CARD_TITLE,
  EYEBROW,
  GAUGE_CENTER,
  GAUGE_SLASH,
  GAUGE_WRAP,
  HOLO_FRAME,
  HOLO_FRAME_BUTTON,
  MINI_CARD,
  MINI_CHIP,
  MINI_DELTA,
  MINI_GRID,
  MINI_LABEL,
  MINI_UNIT,
  MINI_VALUE,
  PANEL_BODY,
  READINESS_STATUS,
  ROW,
  ROW_BAR_FILL,
  ROW_BAR_TRACK,
  ROW_HEAD,
  ROW_ICON,
  ROW_LABEL,
  ROW_LIST,
  ROW_VALUE,
  TABS,
  TAG,
  tabClass,
} from "../mock-classes";

/** One glyph per readiness row (decorative; the label carries the meaning). */
const ROW_ICONS: Record<RowId, ReactNode> = {
  bodyWeight: <Weight aria-hidden="true" />,
  muscleMass: <Dumbbell aria-hidden="true" />,
  boneMineral: <Bone aria-hidden="true" />,
  bodyFat: <Percent aria-hidden="true" />,
  sleepDuration: <Moon aria-hidden="true" />,
  sleepEfficiency: <Bed aria-hidden="true" />,
  hrv: <HeartPulse aria-hidden="true" />,
  fatigue: <Zap aria-hidden="true" />,
  reactionTime: <Timer aria-hidden="true" />,
  mathAccuracy: <Calculator aria-hidden="true" />,
  mood: <Smile aria-hidden="true" />,
  attention: <Eye aria-hidden="true" />,
  energyBurned: <Flame aria-hidden="true" />,
  energyIntake: <Utensils aria-hidden="true" />,
  energyBalance: <Activity aria-hidden="true" />,
  activity: <Footprints aria-hidden="true" />,
};

const PANEL_TITLES = {
  body: "panelBody",
  recovery: "panelRecovery",
  cognitive: "panelCognitive",
  energy: "panelEnergy",
} as const satisfies Record<TabId, keyof Copy["hudMock"]>;

const GAUGE_RADIUS = 46;
const GAUGE_CIRCUMFERENCE = 2 * Math.PI * GAUGE_RADIUS;

export interface ReadinessCardProps {
  readonly readiness: HudMockFixture["readiness"];
  readonly copy: Copy["hudMock"];
}

/**
 * "Overall Readiness": the gradient ring (score/100), the "Stable" status, the small secondary
 * 96/100 value and the status guidance. Every value is simulated; nothing here is a diagnosis.
 */
export function ReadinessCard({ readiness, copy }: ReadinessCardProps) {
  const pct = Math.min(1, Math.max(0, readiness.score / 100));
  return (
    <section className={CARD} aria-label={copy.readinessAria} data-testid="mock-readiness">
      <div className={CARD_HEAD}>
        <h2 className={CARD_TITLE}>{copy.readinessTitle}</h2>
      </div>

      <div className="mt-3 flex items-center gap-4">
        <div
          className={GAUGE_WRAP}
          role="img"
          aria-label={format(copy.readinessScoreAria, { score: String(readiness.score) })}
        >
          <svg viewBox="0 0 104 104" className="size-full -rotate-90" aria-hidden="true" focusable="false">
            <defs>
              <linearGradient id="hudMockReadiness" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#5eead4" />
                <stop offset="55%" stopColor="#7ab8ff" />
                <stop offset="100%" stopColor="#a78bfa" />
              </linearGradient>
            </defs>
            <circle
              cx="52"
              cy="52"
              r={GAUGE_RADIUS}
              fill="none"
              stroke="rgba(122,222,255,.14)"
              strokeWidth="8"
            />
            <circle
              cx="52"
              cy="52"
              r={GAUGE_RADIUS}
              fill="none"
              stroke="url(#hudMockReadiness)"
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={GAUGE_CIRCUMFERENCE}
              strokeDashoffset={GAUGE_CIRCUMFERENCE * (1 - pct)}
            />
          </svg>
          <span className={GAUGE_CENTER} aria-hidden="true">
            {readiness.score}
            <span className={GAUGE_SLASH}>/100</span>
          </span>
        </div>

        <div className="flex min-w-0 flex-1 items-center justify-between gap-3">
          <div className="flex min-w-0 flex-col gap-[5px]">
            <span className="m-0! text-[11px] uppercase tracking-[.16em] text-[#8fb8d4]">
              {copy.readinessTitle}
            </span>
            <span className={READINESS_STATUS}>{copy.readinessStable}</span>
            <span
              className="text-[11px] tabular-nums text-[#8fb8d4]"
              title={format(copy.readinessSupportAria, { value: String(readiness.support) })}
            >
              {readiness.support} /100
            </span>
          </div>
          <div className="flex min-w-0 max-w-[46%] flex-col items-end gap-[4px] text-right">
            <span className={EYEBROW}>{copy.readinessStatus}</span>
            <p className="m-0! text-[11px] font-light leading-snug text-[#cfe4f4]">
              {copy.readinessGuidance}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

export interface ReadinessTabsProps {
  readonly fixture: HudMockFixture;
  readonly copy: Copy["hudMock"];
  /** The holographic body (lazy three.js) — injected by the host so the panel stays testable. */
  readonly holo?: ReactNode;
  /** CC BY 4.0 credit line, rendered under the frame (outside it, so nothing is clipped). */
  readonly holoCredit?: ReactNode;
  /**
   * When provided, the Body-tab hologram frame is a real button that opens `/body`
   * (the host passes its router navigation). Omit to keep the inert, non-interactive frame.
   */
  readonly onOpenBody?: () => void;
}

function Rows({ rows }: { rows: readonly PanelRow[] }) {
  return (
    <ul className={ROW_LIST}>
      {rows.map((row) => (
        <li className={ROW} key={row.id} data-row={row.id}>
          <div className={ROW_HEAD}>
            <span className={ROW_ICON}>{ROW_ICONS[row.id]}</span>
            <p className={ROW_LABEL}>{row.label}</p>
            <span className={ROW_VALUE}>{row.valueText}</span>
          </div>
          <div className={ROW_BAR_TRACK} aria-hidden="true">
            <span className={ROW_BAR_FILL} style={{ width: `${row.barPct}%` } as CSSProperties} />
          </div>
        </li>
      ))}
    </ul>
  );
}

/**
 * Readiness detail: four pill tabs (Body • Recovery • Cognitive • Energy) switching local state, all
 * four panels present, no routing. The Body tab keeps the existing holographic body on the left.
 */
export function ReadinessDetail({ fixture, copy, holo, holoCredit, onOpenBody }: ReadinessTabsProps) {
  const [tab, setTab] = useState<TabId>("body");
  const labels = {
    bodyWeight: copy.metricBodyWeight,
    muscleMass: copy.metricMuscleMass,
    boneMineral: copy.metricBoneMineral,
    bodyFat: copy.metricBodyFat,
    sleepDuration: copy.metricSleepDuration,
    sleepEfficiency: copy.metricSleepEfficiency,
    hrv: copy.metricHrv,
    fatigue: copy.metricFatigue,
    reactionTime: copy.metricReactionTime,
    mathAccuracy: copy.metricMathAccuracy,
    mood: copy.metricMood,
    attention: copy.metricAttention,
    energyBurned: copy.metricEnergyBurned,
    energyIntake: copy.metricEnergyIntake,
    energyBalance: copy.metricEnergyBalance,
    activity: copy.metricActivity,
  } satisfies Record<RowId, string>;
  const panels = buildPanels(labels, {
    fatigue: copy.fatigueLow,
    attention: copy.attentionNormal,
  }, fixture);

  return (
    <section className={CARD} aria-label={copy.tabsAria} data-testid="mock-readiness-detail">
      <div className={CARD_HEAD}>
        <h2 className={CARD_TITLE}>{copy[PANEL_TITLES[tab]]}</h2>
      </div>

      <div className={`${TABS} mt-3 mb-3`} role="tablist" aria-label={copy.tabsAria}>
        {TAB_IDS.map((id) => (
          <button
            key={id}
            type="button"
            role="tab"
            id={`hudMockTab-${id}`}
            aria-selected={tab === id}
            aria-controls={`hudMockPanel-${id}`}
            className={tabClass(tab === id)}
            onClick={() => setTab(id)}
          >
            {copy.tabs[id]}
          </button>
        ))}
      </div>

      <div
        role="tabpanel"
        id={`hudMockPanel-${tab}`}
        aria-labelledby={`hudMockTab-${tab}`}
        data-active-tab={tab}
      >
        {tab === "body" ? (
          <div className={PANEL_BODY}>
            <div className="relative pb-[20px]">
              {onOpenBody ? (
                <button
                  type="button"
                  data-testid="mock-holo-open"
                  onClick={onOpenBody}
                  aria-label={copy.bodyHoloOpen}
                  className={`${HOLO_FRAME} ${HOLO_FRAME_BUTTON}`}
                >
                  {holo}
                </button>
              ) : (
                <div className={HOLO_FRAME} aria-label={copy.bodyHoloAria} role="img">
                  {holo}
                </div>
              )}
              {holoCredit}
            </div>
            <Rows rows={panels.body.rows} />
          </div>
        ) : (
          <Rows rows={panels[tab].rows} />
        )}
      </div>
    </section>
  );
}

export interface MiniCardsProps {
  readonly cards: HudMockFixture["cards"];
  readonly copy: Copy["hudMock"];
}

/** The three mini metric cards under the tabs: activity, energy burned, energy intake. */
export function MiniCards({ cards, copy }: MiniCardsProps) {
  return (
    <section className={MINI_GRID} aria-label={copy.cardsAria} data-testid="mock-mini-cards">
      <article className={MINI_CARD} data-card="activity">
        <h3 className={MINI_LABEL}>
          <Footprints aria-hidden="true" />
          {copy.cardActivity}
        </h3>
        <p className="m-0!">
          <span className={MINI_VALUE}>{cards.activityMinutes}</span>
          <span className={MINI_UNIT}>min</span>
        </p>
        <span className={MINI_DELTA}>
          ▲ +{cards.activityDeltaPct}% {copy.cardActivityDeltaCaption}
        </span>
      </article>

      <article className={MINI_CARD} data-card="burned">
        <h3 className={MINI_LABEL}>
          <Flame aria-hidden="true" />
          {copy.cardEnergyBurned}
        </h3>
        <p className="m-0!">
          <span className={MINI_VALUE}>{groupThousands(cards.burnedKcal)}</span>
          <span className={MINI_UNIT}>kcal</span>
        </p>
        <span className="text-[10px] text-[#7f9db4]">{copy.trendsLast24h}</span>
      </article>

      <article className={MINI_CARD} data-card="intake">
        <h3 className={MINI_LABEL}>
          <Utensils aria-hidden="true" />
          {copy.cardEnergyIntake}
        </h3>
        <p className="m-0!">
          <span className={MINI_VALUE}>{groupThousands(cards.intakeKcal)}</span>
          <span className={MINI_UNIT}>kcal</span>
        </p>
        <span className={MINI_CHIP}>
          {format(copy.balanceCaption, { balance: signedKcal(cards.balanceKcal) })}
        </span>
      </article>
    </section>
  );
}
