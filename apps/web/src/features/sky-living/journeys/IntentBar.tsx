import { useState } from "react";
import { strings } from "./strings";
import type { Locale } from "~/shared/i18n/locale";

export type IntentKey =
  | "why-tired" | "exercise-guidance" | "emergency" | "earth-consult" | "sleep-report" | "unknown";

const INTENT_PATTERNS: { re: RegExp; intent: IntentKey }[] = [
  { re: /uy|tired|mệt|fatigu/i, intent: "why-tired" },
  { re: /je pp|tập|exercise/i, intent: "exercise-guidance" },
  { re: /help|khẩn cấp|emergency/i, intent: "emergency" },
  { re: /earth|consult|hỏi đất liền/i, intent: "earth-consult" },
  { re: /sleep|ngủ/i, intent: "sleep-report" },
];

export function classifyIntent(text: string): IntentKey {
  for (const p of INTENT_PATTERNS) if (p.re.test(text)) return p.intent;
  return "unknown";
}

interface Props {
  locale: Locale;
  processing: boolean;
  onSubmit: (intent: IntentKey, raw: string) => void;
}

export function IntentBar({ locale, processing, onSubmit }: Props) {
  const s = strings[locale];
  const [value, setValue] = useState("");
  return (
    <div className="intentBar">
      <button type="button" aria-label="mic" className="micGlyph">🎤</button>
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={s.intentPlaceholder}
        disabled={processing}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !processing) {
            onSubmit(classifyIntent(value), value);
            setValue("");
          }
        }}
      />
      <button
        type="button"
        disabled={processing}
        onClick={() => {
          onSubmit(classifyIntent(value), value);
          setValue("");
        }}
      >
        {s.submit}
      </button>
    </div>
  );
}
export { INTENT_PATTERNS };
