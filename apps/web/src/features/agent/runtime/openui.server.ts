import "@tanstack/react-start/server-only";

export type ValidateReason = "empty" | "too_long" | "digit_in_text" | "unknown_component" | "no_component";
export type ValidateResult = { ok: true; program: string } | { ok: false; reason: ValidateReason };

export function stripFences(text: string): string {
  return text.replace(/```[a-z]*\n?/gi, "").replace(/```/g, "").trim();
}

export function validateProgram(program: string, maxChars: number, allowList: readonly string[]): ValidateResult {
  const cleaned = stripFences(program);
  if (!cleaned) return { ok: false, reason: "empty" };
  if (cleaned.length > maxChars) return { ok: false, reason: "too_long" };
  if (/\d/.test(cleaned)) return { ok: false, reason: "digit_in_text" };
  const comps = Array.from(cleaned.matchAll(/\b([A-Z][A-Za-z0-9_]*)\b/g)).map((m) => m[1] as string);
  for (const c of comps) {
    if (!allowList.includes(c)) return { ok: false, reason: "unknown_component" };
  }
  if (comps.length === 0 || !comps.some((c) => allowList.includes(c))) {
    return { ok: false, reason: "no_component" };
  }
  return { ok: true, program: cleaned };
}
