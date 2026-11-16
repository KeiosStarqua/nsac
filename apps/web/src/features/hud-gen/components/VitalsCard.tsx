import { Droplet, HeartPulse, Thermometer, Wind, Activity, AudioWaveform } from "lucide-react";
import type { ReactNode } from "react";
import type { Copy } from "~/shared/i18n";
import type { LiveStripMode } from "../../live-health";
import { formatBloodPressure, type HudMockFixture } from "../data/fixture";
import {
  CARD,
  CARD_HEAD,
  CARD_TITLE,
  TAG,
  TAG_LIVE,
  LIVE_DOT_LIVE,
  LIVE_DOT_HISTORICAL,
  LIVE_DOT_OFFLINE,
  VITAL_ICON,
  VITAL_LABEL,
  VITAL_ROW,
  VITAL_SPARK,
  VITAL_VALUE,
  FILL_CARD,
} from "../mock-classes";
import { Sparkline } from "./Sparkline";

export interface VitalsCardProps {
  readonly vitalSigns: HudMockFixture["vitalSigns"];
  readonly copy: Copy["hudMock"];
  /**
   * When the host has settled a read of the live (simulated) telemetry feed, the `Now` tag is
   * replaced by the honest LIVE / HISTORICAL / OFFLINE chip (same labels as `/performance`).
   * Omit (or pass `null`) while settling — the plain `Now` tag renders, as before.
   */
  readonly liveMode?: LiveStripMode | null;
  /** Localized chip label matching `liveMode` (e.g. `copy.live.visibleLive`). */
  readonly liveLabel?: string | null;
}

interface Row {
  readonly key: string;
  readonly icon: ReactNode;
  readonly label: string;
  readonly value: ReactNode;
  readonly series: readonly number[];
}

/**
 * "Vital Signs" card — six fixture rows (heart rate, HRV, blood pressure, respiratory rate, SpO₂,
 * body temperature), each with a 24-point inline sparkline. Values are simulated; the units stay
 * English exactly as the fixture writes them. When the host passes a settled `liveMode`,
 * the header chip reports the live feed's state instead of the static `Now` tag.
 */
export function VitalsCard({ vitalSigns, copy, liveMode = null, liveLabel = null }: VitalsCardProps) {
  const liveChip = liveMode && liveLabel ? (
    <span className={TAG_LIVE} data-testid="vitals-live-chip" data-state={liveMode}>
      <span
        aria-hidden="true"
        className={
          liveMode === "live" ? LIVE_DOT_LIVE : liveMode === "historical" ? LIVE_DOT_HISTORICAL : LIVE_DOT_OFFLINE
        }
      />
      <span className="whitespace-nowrap">{liveLabel}</span>
    </span>
  ) : null;
  const rows: Row[] = [
    {
      key: "heartRate",
      icon: <HeartPulse aria-hidden="true" />,
      label: copy.vitalHeartRate,
      value: (
        <>
          {vitalSigns.heartRate.value} <small>{vitalSigns.heartRate.unit}</small>
        </>
      ),
      series: vitalSigns.heartRate.series,
    },
    {
      key: "heartRateVariability",
      icon: <AudioWaveform aria-hidden="true" />,
      label: copy.vitalHrv,
      value: (
        <>
          {vitalSigns.heartRateVariability.value} <small>{vitalSigns.heartRateVariability.unit}</small>
        </>
      ),
      series: vitalSigns.heartRateVariability.series,
    },
    {
      key: "bloodPressure",
      icon: <Activity aria-hidden="true" />,
      label: copy.vitalBloodPressure,
      value: (
        <>
          {formatBloodPressure(vitalSigns.bloodPressure.systolic, vitalSigns.bloodPressure.diastolic)}{" "}
          <small>{vitalSigns.bloodPressure.unit}</small>
        </>
      ),
      series: vitalSigns.bloodPressure.series,
    },
    {
      key: "respiratoryRate",
      icon: <Wind aria-hidden="true" />,
      label: copy.vitalRespiratoryRate,
      value: (
        <>
          {vitalSigns.respiratoryRate.value} <small>{vitalSigns.respiratoryRate.unit}</small>
        </>
      ),
      series: vitalSigns.respiratoryRate.series,
    },
    {
      key: "bloodOxygen",
      icon: <Droplet aria-hidden="true" />,
      label: copy.vitalBloodOxygen,
      value: (
        <>
          {vitalSigns.bloodOxygen.value} <small>{vitalSigns.bloodOxygen.unit}</small>
        </>
      ),
      series: vitalSigns.bloodOxygen.series,
    },
    {
      key: "bodyTemperature",
      icon: <Thermometer aria-hidden="true" />,
      label: copy.vitalBodyTemperature,
      value: (
        <>
          {vitalSigns.bodyTemperature.value} <small>{vitalSigns.bodyTemperature.unit}</small>
        </>
      ),
      series: vitalSigns.bodyTemperature.series,
    },
  ];

  return (
    <section className={`${CARD} ${FILL_CARD}`} aria-label={copy.vitalsAria} data-testid="mock-vitals">
      <div className={`${CARD_HEAD} mb-[6px] flex-none`}>
        <h2 className={CARD_TITLE}>{copy.vitalsTitle}</h2>
        {liveChip ?? <span className={TAG}>{copy.vitalsNow}</span>}
      </div>
      <div className="flex min-h-0 flex-1 flex-col justify-evenly">
        {rows.map((row) => (
          <div className={VITAL_ROW} key={row.key} data-vital={row.key}>
            <span className={VITAL_ICON} aria-hidden="true">
              {row.icon}
            </span>
            <p className={VITAL_LABEL}>{row.label}</p>
            <span className={VITAL_VALUE}>{row.value}</span>
            <Sparkline points={row.series} className={VITAL_SPARK} width={66} height={26} />
          </div>
        ))}
      </div>
    </section>
  );
}
