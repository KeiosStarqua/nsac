import type { CSSProperties } from "react";
import type { Copy } from "~/shared/i18n";
import { format } from "~/shared/i18n";
import { formatSleep, type HudMockFixture } from "../model/fixture";
import {
  ACTIVITY_BAR,
  ACTIVITY_BARS,
  CARD,
  CARD_HEAD,
  CARD_TITLE,
  SLEEP_BAR,
  SLEEP_BLOCK,
  TAG,
  TREND_BLOCK,
  TREND_CAPTION,
  TREND_HEAD,
  TREND_LABEL,
  TREND_SPARK,
} from "../mock-classes";
import { Sparkline } from "./Sparkline";

export interface TrendsCardProps {
  readonly trends: HudMockFixture["quickTrends"];
  readonly copy: Copy["hudMock"];
}

/**
 * "Quick Trends (Last 24h)": heart-rate sparkline with its average, the segmented sleep bar and the
 * activity strip. Sleep and activity read the same fixture fields as the readiness panels.
 */
export function TrendsCard({ trends, copy }: TrendsCardProps) {
  const sleepText = formatSleep(trends.sleepMinutes);
  const activityText = `${trends.activityMinutes} min`;

  return (
    <section className={CARD} aria-label={copy.trendsAria} data-testid="mock-trends">
      <div className={CARD_HEAD}>
        <h2 className={CARD_TITLE}>{copy.trendsTitle}</h2>
        <span className={TAG}>{copy.trendsLast24h}</span>
      </div>

      <div className="mt-[4px]">
        <div className={TREND_BLOCK} data-trend="heartRate">
          <div className={TREND_HEAD}>
            <p className={TREND_LABEL}>{copy.trendHeartRate}</p>
            <span className={TREND_CAPTION}>
              {format(copy.trendAvg, { value: String(trends.heartRateAvg) })}
            </span>
          </div>
          <Sparkline points={trends.heartRateSeries} className={TREND_SPARK} width={100} height={34} />
        </div>

        <div className={TREND_BLOCK} data-trend="sleep">
          <div className={TREND_HEAD}>
            <p className={TREND_LABEL}>{copy.trendSleep}</p>
            <span className={TREND_CAPTION}>{sleepText}</span>
          </div>
          <div className={SLEEP_BAR} aria-hidden="true">
            {trends.sleepBlocks.map((block, index) => (
              <span
                key={index}
                className={SLEEP_BLOCK}
                style={{ flexGrow: Math.max(0.1, block) } as CSSProperties}
              />
            ))}
          </div>
        </div>

        <div className={TREND_BLOCK} data-trend="activity">
          <div className={TREND_HEAD}>
            <p className={TREND_LABEL}>{copy.trendActivity}</p>
            <span className={TREND_CAPTION}>{activityText}</span>
          </div>
          <div className={ACTIVITY_BARS} aria-hidden="true">
            {trends.activityBars.map((bar, index) => (
              <span
                key={index}
                className={ACTIVITY_BAR}
                style={{ height: `${Math.max(6, Math.round(bar * 100))}%` }}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
