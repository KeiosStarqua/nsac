import { useLocale } from "~/shared/i18n";
import { DEVICE_ORDER } from "../model/devices";
import { strings } from "./strings";
import styles from "./DeviceSwitcher.module.css";

export interface DeviceSwitcherProps {
  device: string;
  onChange: (device: any) => void;
}

export function DeviceSwitcher({ device, onChange }: DeviceSwitcherProps) {
  const locale = useLocale();
  const s = strings[locale];
  return (
    <div className={styles.switcher} aria-label={s.deviceSimulation}>
      {DEVICE_ORDER.map((d) => (
        <button
          key={d}
          type="button"
          className={styles.btn + (d === device ? " " + styles.active : "")}
          aria-label={d}
          aria-pressed={d === device}
          onClick={() => onChange(d)}
        >
          {d}
        </button>
      ))}
    </div>
  );
}