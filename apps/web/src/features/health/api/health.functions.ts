import { createServerFn } from "@tanstack/react-start";
import { existsSync } from "node:fs";
import {
  redactEnv,
  reduceOverall,
  overallLabel,
  type Check,
  type CheckState,
} from "../model/health";
import {
  currentAgentModel,
  currentAgentProvider,
  currentAgentProviderInfo,
} from "../../agent/runtime/agent-model.server";
import { readOpenCodeKey, readOpenRouterKey } from "../../agent/runtime/pi.server";

export type Snapshot = {
  checks: Check[];
  overall: CheckState;
  overallLabel: string;
  checkedAt: string;
};

function makeCheck(checkId: string, label: string, state: CheckState, detail: string, hint?: string): Check {
  return { checkId, label, state, detail, hint };
}

const AGENT_PROFILE_CHECKS: Array<{ readonly id: string; readonly label: string }> = [
  { id: "sky-chat", label: "Chat" },
  { id: "sky-orchestrator", label: "Orchestrator" },
  { id: "sky-generative-ui", label: "Generative UI" },
  { id: "sky-hud-composer", label: "HUD Composer" },
];

export const getSnapshot = createServerFn({ method: "GET" }).handler(async (): Promise<Snapshot> => {
  const checks: Check[] = [];

  const { provider, source } = await currentAgentProviderInfo();
  checks.push(
    makeCheck(
      "agent.provider",
      "Agent provider",
      "ok",
      `${provider} (source: ${source})`,
      source === "default" ? "Default when nothing is set — set agent.provider on the backend or SKY_AGENT_PROVIDER" : undefined,
    ),
  );

  const keyInfo =
    provider === "opencode-go"
      ? redactEnv(process.env.SKY_OPENCODE_API_KEY ?? process.env.OPENCODE_API_KEY)
      : redactEnv(process.env.SKY_OPENROUTER_API_KEY);
  checks.push(
    makeCheck(
      provider === "opencode-go" ? "go.key" : "openrouter.key",
      provider === "opencode-go" ? "OpenCode Go API key" : "OpenRouter API key",
      keyInfo.configured ? "ok" : "fail",
      keyInfo.configured ? `configured (length ${keyInfo.length})` : "not configured",
      keyInfo.configured
        ? undefined
        : provider === "opencode-go"
          ? "Set SKY_OPENCODE_API_KEY (or OPENCODE_API_KEY) in /etc/nsac-web/env or .env"
          : "Set SKY_OPENROUTER_API_KEY in /etc/nsac-web/env or .env",
    ),
  );

  // Effective model per profile (same source the agent uses), một dòng.
  const [fallbackModel, ...profileModels] = await Promise.all([
    currentAgentModel(),
    ...AGENT_PROFILE_CHECKS.map((p) => currentAgentModel(p.id)),
  ]);
  const effective = [
    `default=${fallbackModel}`,
    ...AGENT_PROFILE_CHECKS.map((p, i) => `${p.id}=${profileModels[i]}`),
  ].join("; ");
  checks.push(makeCheck("agent.models", "Agent models", "ok", effective));

  const nodeVersion = process.version;
  const env = process.env.NODE_ENV ?? "development";
  const port = process.env.PORT ?? "3100";
  const uptime = Math.round(process.uptime());
  const buildId = process.env.SKY_BUILD_ID?.trim() || "unknown";
  checks.push(
    makeCheck(
      "runtime",
      "Runtime",
      "ok",
      `node ${nodeVersion}, NODE_ENV=${env}, port=${port}, uptime=${uptime}s, build=${buildId}, time=${new Date().toISOString()}`,
    ),
  );

  let envFileExists = false;
  try {
    envFileExists = existsSync("/etc/nsac-web/env");
  } catch {
    envFileExists = false;
  }
  checks.push(
    makeCheck(
      "envFile",
      "Env file (/etc/nsac-web/env)",
      envFileExists ? "ok" : "warn",
      envFileExists ? "exists" : "not present (normal locally)",
      envFileExists ? undefined : "On the box it must exist; locally .env is used",
    ),
  );

  let dataDirWritable = false;
  try {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const dir = path.resolve(process.cwd(), "var");
    if (!existsSync(dir)) {
      try {
        fs.mkdirSync(dir, { recursive: true });
      } catch {
        // ignore
      }
    }
    const tmp = path.join(dir, `.health-${Date.now()}`);
    fs.writeFileSync(tmp, "x");
    fs.unlinkSync(tmp);
    dataDirWritable = true;
  } catch {
    dataDirWritable = false;
  }
  checks.push(
    makeCheck(
      "dataDir",
      "var/ directory",
      dataDirWritable ? "ok" : "warn",
      dataDirWritable ? "exists and writable" : "not writable",
    ),
  );

  for (const [envKey, label, checkId] of [
    ["BACKEND_URL", "Backend", "backend"],
    ["OLLAMA_URL", "Ollama", "ollama"],
  ] as const) {
    const url = process.env[envKey];
    if (!url) {
      checks.push(makeCheck(checkId, label, "unknown", "not configured"));
      continue;
    }
    let state: CheckState = "unknown";
    let detail = "";
    try {
      const controller = new AbortController();
      const t = setTimeout(() => controller.abort(), 3000);
      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(t);
      state = res.ok ? "ok" : "warn";
      detail = `HTTP ${res.status}`;
    } catch (e) {
      state = "fail";
      detail = "unreachable";
    }
    checks.push(makeCheck(checkId, label, state, detail));
  }

  const overall = reduceOverall(checks);
  const checkedAt = new Date().toISOString();
  return { checks, overall, overallLabel: overallLabel(overall), checkedAt };
});

/**
 * Live check (thủ công): xác nhận key của provider đang chọn. OpenCode Go dùng `GET /inference/v1/models`
 * với bearer key (endpoint danh sách models cần auth theo docs OpenCode); OpenRouter giữ probe `/api/v1/key` cũ.
 */
export const validateKey = createServerFn({ method: "POST" }).handler(async () => {
  const provider = await currentAgentProvider();
  const key = provider === "opencode-go" ? readOpenCodeKey() : readOpenRouterKey();
  if (!key) {
    return { provider, status: "missing" as const, httpStatus: null, credit: null, limit: null };
  }
  try {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), 6000);
    const url =
      provider === "opencode-go"
        ? "https://opencode.ai/inference/v1/models"
        : "https://openrouter.ai/api/v1/key";
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${key}` },
      signal: controller.signal,
    });
    clearTimeout(t);
    if (res.status === 200) {
      let credit: number | null = null;
      let limit: number | null = null;
      if (provider === "openrouter") {
        try {
          const json = await res.json();
          credit = typeof json?.data?.total_credits === "number" ? json.data.total_credits : null;
          limit = typeof json?.data?.limit === "number" ? json.data.limit : null;
        } catch {
          // ignore
        }
      }
      return { provider, status: "valid" as const, httpStatus: res.status, credit, limit };
    }
    return { provider, status: "invalid" as const, httpStatus: res.status, credit: null, limit: null };
  } catch {
    return { provider, status: "unreachable" as const, httpStatus: null, credit: null, limit: null };
  }
});

/** Live check (thủ công): model id hiệu lực có nằm trong catalog của provider đang chọn không. */
export const checkModel = createServerFn({ method: "POST" }).handler(async () => {
  const provider = await currentAgentProvider();
  const key = provider === "opencode-go" ? readOpenCodeKey() : readOpenRouterKey();
  const modelId = await currentAgentModel();
  if (!key) return { provider, result: "missing" as const };
  try {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), 6000);
    const url =
      provider === "opencode-go"
        ? "https://opencode.ai/inference/v1/models"
        : "https://openrouter.ai/api/v1/models";
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${key}` },
      signal: controller.signal,
    });
    clearTimeout(t);
    if (!res.ok) return { provider, result: "unreachable" as const };
    const json = await res.json();
    const ids: string[] = Array.isArray(json?.data)
      ? json.data.map((m: any) => m?.id).filter(Boolean)
      : [];
    return { provider, result: ids.includes(modelId) ? ("found" as const) : ("not-found" as const) };
  } catch {
    return { provider, result: "unreachable" as const };
  }
});
