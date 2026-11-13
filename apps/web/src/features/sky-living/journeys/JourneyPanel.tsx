import { strings } from "./strings";
import type { Locale } from "~/shared/i18n/locale";

const JOURNEYS: { id: string; key: keyof typeof strings.en }[] = [
  { id: "wellness", key: "wellness" },
  { id: "recovery-deviation", key: "recovery" },
  { id: "evidence", key: "evidence" },
  { id: "exercise-decision", key: "exercise" },
  { id: "emergency", key: "emergency" },
  { id: "eva", key: "eva" },
  { id: "earth-consult", key: "earth" },
];

interface Props {
  locale: Locale;
  onPick: (id: string) => void;
}

export function JourneyPanel({ locale, onPick }: Props) {
  const s = strings[locale];
  return (
    <div className="journeyPanel">
      <h3>{s.journeys}</h3>
      {JOURNEYS.map((j) => (
        <button key={j.id} type="button" onClick={() => onPick(j.id)}>
          {String(s[j.key])}
        </button>
      ))}
    </div>
  );
}
