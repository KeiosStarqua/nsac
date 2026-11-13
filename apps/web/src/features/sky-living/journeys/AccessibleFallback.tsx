import { MEASUREMENTS } from "../model/data";
import { strings } from "./strings";
import type { Locale } from "~/shared/i18n/locale";

interface Props {
  locale: Locale;
}

export function AccessibleFallback({ locale }: Props) {
  const s = strings[locale];
  return (
    <div className="accessibleFallback">
      <h2>{s.textToggle}</h2>
      <ul>
        {MEASUREMENTS.map((m) => (
          <li key={m.metric}>
            {m.label}: {m.display} ({s.simulatedData})
          </li>
        ))}
      </ul>
    </div>
  );
}
