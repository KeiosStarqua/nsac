import { Droplet, HeartPulse, Thermometer, Wind, Activity } from "lucide-react";
import type { ReactNode } from "react";
import type { Copy } from "~/shared/i18n";
import { formatBloodPressure, type HudMockFixture } from "../model/fixture";
import {
  CARD,
  CARD_HEAD,
  CARD_TITLE,
  TAG,
  VITAL_ICON,
  VITAL_LABEL,
  VITAL_ROW,
  VITAL_SPARK,
  VITAL_VALUE,
} from "../mock-classes";
import { Sparkline } from "./Sparkline";

export interface VitalsCardProps {
  readonly vitalSigns: HudMockFixture["vitalSigns"];
  readonly copy: Copy["hudMock"];
}

interface Row {
  readonly key: string;
  readonly icon: ReactNode;
  readonly label: string;
  readonly value: ReactNode;
  readonly series: readonly number[];
}

/**
 * "Vital Signs" card — five fixture rows (heart rate, blood pressure, respiratory rate, SpO₂,
 * body temperature), each with a 24-point inline sparkline. Values are simulated; the units stay
 * English exactly as the reference mock writes them.
 */
export function VitalsCard({ vitalSigns, copy }: VitalsCardProps) {
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
    <section className={CARD} aria-label={copy.vitalsAria} data-testid="mock-vitals">
      <div className={`${CARD_HEAD} mb-[6px]`}>
        <h2 className={CARD_TITLE}>{copy.vitalsTitle}</h2>
        <span className={TAG}>{copy.vitalsNow}</span>
      </div>
      <div>
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
