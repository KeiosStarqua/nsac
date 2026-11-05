import type { Intervention } from "./types";

/**
 * Compact string form so confirmed actions can live in a URL search param.
 *   "4:masks" | "4:ventilation" | "5:quarantine:c3" | "9:release:c3"
 */
export const INTERVENTION_PATTERN = /^\d{1,2}:(masks|ventilation|(quarantine|release):c\d{1,2})$/;

export function formatIntervention(iv: Intervention): string {
  return "memberId" in iv ? `${iv.day}:${iv.type}:${iv.memberId}` : `${iv.day}:${iv.type}`;
}

export function parseIntervention(text: string): Intervention | null {
  if (!INTERVENTION_PATTERN.test(text)) return null;
  const [dayText, type, memberId] = text.split(":");
  const day = Number(dayText);
  if (type === "masks" || type === "ventilation") return { day, type };
  if ((type === "quarantine" || type === "release") && memberId) return { day, type, memberId };
  return null;
}

export function parseInterventions(list: readonly string[]): Intervention[] {
  return list.flatMap((t) => {
    const iv = parseIntervention(t);
    return iv ? [iv] : [];
  });
}
