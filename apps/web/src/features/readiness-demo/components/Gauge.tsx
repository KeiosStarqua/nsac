import type { Severity } from "../model/readiness";
import styles from "./Gauge.module.css";

const RADIUS = 52;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

interface GaugeProps {
  value: number;
  severity: Severity;
  label: string;
  severityLabel: string;
  rangeLabel: string;
}

/** Ring gauge. `role="meter"` exposes the value to assistive tech, colour is never the only signal. */
export function Gauge({ value, severity, label, severityLabel, rangeLabel }: GaugeProps) {
  const clamped = Math.min(100, Math.max(0, value));
  return (
    <div
      className={styles.gauge}
      data-severity={severity}
      role="meter"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={clamped}
      aria-valuetext={`${clamped}, ${severityLabel}`}
    >
      <svg viewBox="0 0 120 120" aria-hidden="true">
        <circle className={styles.track} cx="60" cy="60" r={RADIUS} />
        <circle
          className={styles.value}
          cx="60"
          cy="60"
          r={RADIUS}
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={CIRCUMFERENCE * (1 - clamped / 100)}
          transform="rotate(-90 60 60)"
        />
      </svg>
      <div className={styles.readout}>
        <span className={styles.score}>{clamped}</span>
        <span className={styles.sev}>{severityLabel}</span>
        <span className={styles.range}>{rangeLabel}</span>
      </div>
    </div>
  );
}
