import { createServerFn } from "@tanstack/react-start";
import { existsSync } from "node:fs";
import {
  redactEnv,
  resolveModel,
  reduceOverall,
  formatDiagnostics,
  overallLabel,
  DEFAULT_MODEL,
  type Check,
  type CheckState,
} from "../model/health";

export type Snapshot = {
  checks: Check[];
  overall: CheckState;
  overallLabel: string;
  checkedAt: string;
};

function makeCheck(checkId: string, label: string, state: CheckState, detail: string, hint?: string): Check {
  return { checkId, label, state, detail, hint };
}

export const getSnapshot = createServerFn({ method: "GET" }).handler(async (): Promise<Snapshot> => {
  const checks: Check[] = [];
  const keyInfo = redactEnv(process.env.SKY_OPENROUTER_API_KEY);
  checks.push(
    makeCheck(
      "openrouter.key",
      "OpenRouter API key",
      keyInfo.configured ? "ok" : "fail",
      keyInfo.configured ? `configured (length ${keyInfo.length})` : "not configured",
      keyInfo.configured ? undefined : "Set SKY_OPENROUTER_API_KEY in /etc/nsac-web/env or .env",
    ),
  );

  const modelId = resolveModel(process.env.SKY_MODEL);
  checks.push(
    makeCheck("openrouter.model", "OpenRouter model", "ok", `effective model: ${modelId}`),
  );

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

export const validateOpenRouterKey = createServerFn({ method: "POST" }).handler(async () => {
  const key = process.env.SKY_OPENROUTER_API_KEY?.trim();
  if (!key) return { status: "missing" as const, httpStatus: null, credit: null, limit: null };
  try {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), 6000);
    const res = await fetch("https://openrouter.ai/api/v1/key", {
      headers: { Authorization: `Bearer ${key}` },
      signal: controller.signal,
    });
    clearTimeout(t);
    if (res.status === 200) {
      let credit: number | null = null;
      let limit: number | null = null;
      try {
        const json = await res.json();
        credit = typeof json?.data?.total_credits === "number" ? json.data.total_credits : null;
        limit = typeof json?.data?.limit === "number" ? json.data.limit : null;
      } catch {
        // ignore
      }
      return { status: "valid" as const, httpStatus: res.status, credit, limit };
    }
    if (res.status === 401 || res.status === 403) {
      return { status: "invalid" as const, httpStatus: res.status, credit: null, limit: null };
    }
    return { status: "invalid" as const, httpStatus: res.status, credit: null, limit: null };
  } catch {
    return { status: "unreachable" as const, httpStatus: null, credit: null, limit: null };
  }
});

export const checkModel = createServerFn({ method: "POST" }).handler(async () => {
  const key = process.env.SKY_OPENROUTER_API_KEY?.trim();
  const modelId = resolveModel(process.env.SKY_MODEL);
  if (!key) return { result: "missing" as const };
  try {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), 6000);
    const res = await fetch("https://openrouter.ai/api/v1/models", {
      headers: { Authorization: `Bearer ${key}` },
      signal: controller.signal,
    });
    clearTimeout(t);
    if (!res.ok) return { result: "unreachable" as const };
    const json = await res.json();
    const ids: string[] = Array.isArray(json?.data) ? json.data.map((m: any) => m?.id).filter(Boolean) : [];
    return { result: ids.includes(modelId) ? ("found" as const) : ("not-found" as const) };
  } catch {
    return { result: "unreachable" as const };
  }
});