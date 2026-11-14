import { useLocale } from "~/shared/i18n";
import { STRINGS } from "./strings";
import { greetingFor } from "../domain";

export interface GreetingPromptProps {
  displayName?: string;
  timeOfDay?: number;
  prompt?: string;
  conversationPhase?: string;
}

export function GreetingPrompt({ displayName = "Minh", timeOfDay, prompt }: GreetingPromptProps) {
  const locale = useLocale();
  const s = STRINGS[locale];
  const hour = timeOfDay ?? new Date().getHours();
  const greeting = greetingFor(locale, hour, displayName);
  const question = prompt ?? s.question;
  return (
    <div style={{ textAlign: "center" }}>
      <div style={{ fontSize: 42, fontWeight: 300, color: "#ecf7ff" }}>{greeting}</div>
      <div style={{ fontSize: 26, color: "#a8bdd0", marginTop: 6 }}>{question}</div>
    </div>
  );
}