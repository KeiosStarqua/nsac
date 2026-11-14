export type CheckState = "ok" | "warn" | "fail" | "unknown";

export type Check = {
  checkId: string;
  label: string;
  state: CheckState;
  detail: string;
  hint?: string;
};

export const DEFAULT_MODEL = "anthropic/claude-sonnet-4.5";

export function redactEnv(value: string | undefined): { configured: boolean; length: number } {
  const v = value ?? "";
  return { configured: v.trim().length > 0, length: v.trim().length };
}

export function resolveModel(envModel: string | undefined): string {
  const v = (envModel ?? "").trim();
  return v.length > 0 ? v : DEFAULT_MODEL;
}

export function reduceOverall(checks: Check[]): CheckState {
  const ranks: Record<CheckState, number> = { unknown: 0, ok: 1, warn: 2, fail: 3 };
  let worst: CheckState = "unknown";
  for (const c of checks) {
    if (ranks[c.state] > ranks[worst]) worst = c.state;
  }
  // If everything unknown, stay unknown; else worst non-unknown.
  const nonUnknown = checks.filter((c) => c.state !== "unknown");
  if (nonUnknown.length === 0) return "unknown";
  let w: CheckState = nonUnknown[0]!.state;
  for (const c of nonUnknown) {
    if (ranks[c.state] > ranks[w]) w = c.state;
  }
  return w;
}

export function formatDiagnostics(checks: Check[], overall: CheckState, checkedAt: string): string {
  const lines: string[] = [];
  lines.push(`Overall: ${overall}`);
  lines.push(`Checked at: ${checkedAt}`);
  lines.push("");
  for (const c of checks) {
    lines.push(`${c.checkId}: ${c.state} — ${c.detail}${c.hint ? " (" + c.hint + ")" : ""}`);
  }
  return lines.join("\n");
}

export function overallLabel(state: CheckState): string {
  switch (state) {
    case "ok":
      return "Ready";
    case "warn":
      return "Needs attention";
    case "fail":
      return "Degraded";
    default:
      return "Unknown";
  }
}