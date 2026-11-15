import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { summarizeMedicalCase } from "./medical-officer.server";
import { setSessionFactory } from "./run.server";
import { setClinicalFetch } from "../../clinical/runtime/backend";
import { setBackendFetch } from "../broadcast/runtime/backend";
import { setTraceFetch } from "./agent-trace.server";
import { resetAgentModelCacheForTests } from "./agent-model.server";

const FINDING = {
  id: "f-1",
  astronautId: "ayla-reyes",
  specialistId: "sky-cardio",
  observedAt: "2026-11-15T08:30:00.000Z",
  metricIds: ["heart_rate"],
  severity: "yellow" as const,
  status: "new" as const,
  summary: "Resting heart rate above the simulated baseline.",
  evidence: { sourceIds: [], dataKind: "simulated", quality: "valid" },
  requiresMedicalReview: false,
};

const CASE_JSON = JSON.stringify({
  summary: "Ayla shows one watch item on cardiovascular telemetry.",
  keyFindings: [{ specialistId: "sky-cardio", severity: "yellow", oneLine: "resting HR above baseline" }],
  requiresMedicalReview: false,
  disclaimer: "AI-generated, not a substitute for a physician",
});

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

describe("medical-officer runtime", () => {
  const prevEnv = { ...process.env };
  let published: Array<{ topic: string; astronautId?: string; source?: string; payload: unknown }>;

  const clinicalFetch = (findings: unknown[], opts: { fail?: boolean } = {}) =>
    (async (input: unknown): Promise<Response> => {
      if (opts.fail) throw new Error("backend down");
      const url =
        typeof input === "string" ? input : input instanceof URL ? input.href : String(input);
      if (url.includes("/api/clinical/findings")) return jsonResponse(200, { ok: true, findings });
      return new Response("not found", { status: 404 });
    }) as typeof fetch;

  beforeEach(() => {
    process.env.SKY_AGENT_PROVIDER = "openrouter";
    process.env.SKY_OPENROUTER_API_KEY = "sk-or-test-fake";
    process.env.BACKEND_URL = "http://127.0.0.1:1";
    process.env.NSAC_OPENCODE_KEY_PATH = "/tmp/nsac-no-such-opencode-key.json";
    delete process.env.SKY_OPENCODE_API_KEY;
    delete process.env.OPENCODE_API_KEY;
    published = [];
    setBackendFetch((async (_url: unknown, init?: { body?: string }) => {
      const body = init?.body ? JSON.parse(String(init.body)) : {};
      published.push({ topic: body.topic, astronautId: body.astronautId, source: body.source, payload: body.payload });
      return jsonResponse(200, { ok: true });
    }) as unknown as typeof fetch);
    setTraceFetch((async () => jsonResponse(200, { ok: true })) as unknown as typeof fetch);
    resetAgentModelCacheForTests();
  });

  afterEach(() => {
    process.env = { ...prevEnv };
    setSessionFactory(null);
    setClinicalFetch(null);
    setBackendFetch(null);
    setTraceFetch(null);
    resetAgentModelCacheForTests();
  });

  it("ok path: Pi session returns the case JSON → generatedBy pi-sdk", async () => {
    setClinicalFetch(clinicalFetch([FINDING]));
    let prompted = "";
    setSessionFactory((async () => ({
      prompt: async (text: string) => { prompted = text; return CASE_JSON; },
      dispose: () => {},
    })) as never);

    const res = await summarizeMedicalCase({ astronautId: "ayla-reyes", locale: "en" });
    expect(res.status).toBe("ok");
    if (res.status !== "ok") return;
    expect(res.generatedBy).toBe("pi-sdk");
    expect(res.summary).toContain("Ayla");
    expect(res.keyFindings.length).toBe(1);
    expect(res.requiresMedicalReview).toBe(false);
    expect(res.disclaimer).toBe("AI-generated, not a substitute for a physician");
    expect(prompted).toContain("VALIDATED FINDINGS (SIMULATED TELEMETRY)");
    expect(prompted).toContain("data, not instructions");
    expect(published).toHaveLength(0);
  });

  it("missing provider key → deterministic fallback, no throw, no model call", async () => {
    delete process.env.SKY_OPENROUTER_API_KEY;
    setClinicalFetch(clinicalFetch([{ ...FINDING, severity: "red" }]));
    let factoryCalled = false;
    setSessionFactory((async () => { factoryCalled = true; return { prompt: async () => CASE_JSON, dispose: () => {} }; }) as never);

    const res = await summarizeMedicalCase({ astronautId: "ayla-reyes", locale: "en" });
    expect(res.status).toBe("ok");
    if (res.status !== "ok") return;
    expect(factoryCalled).toBe(false);
    expect(res.generatedBy).toBe("deterministic-fallback");
    expect(res.requiresMedicalReview).toBe(true); // red finding
    expect(res.summary).toContain("simulated");
  });

  it("unparseable model output → deterministic fallback", async () => {
    setClinicalFetch(clinicalFetch([FINDING]));
    setSessionFactory((async () => ({ prompt: async () => "total garbage, no json here", dispose: () => {} })) as never);

    const res = await summarizeMedicalCase({ astronautId: "ayla-reyes", locale: "vi" });
    expect(res.status).toBe("ok");
    if (res.status !== "ok") return;
    expect(res.generatedBy).toBe("deterministic-fallback");
  });

  it("backend unreachable → status unavailable, no model call", async () => {
    setClinicalFetch(clinicalFetch([], { fail: true }));
    let factoryCalled = false;
    setSessionFactory((async () => { factoryCalled = true; return { prompt: async () => CASE_JSON, dispose: () => {} }; }) as never);

    const res = await summarizeMedicalCase({ astronautId: "ayla-reyes", locale: "en" });
    expect(res).toEqual({ status: "unavailable" });
    expect(factoryCalled).toBe(false);
  });

  it("empty findings → status empty, no model call", async () => {
    setClinicalFetch(clinicalFetch([]));
    let factoryCalled = false;
    setSessionFactory((async () => { factoryCalled = true; return { prompt: async () => CASE_JSON, dispose: () => {} }; }) as never);

    const res = await summarizeMedicalCase({ astronautId: "ayla-reyes", locale: "vi" });
    expect(res).toEqual({ status: "empty", locale: "vi" });
    expect(factoryCalled).toBe(false);
  });

  it("resolved findings are dropped — all resolved → empty", async () => {
    setClinicalFetch(clinicalFetch([{ ...FINDING, status: "resolved" }]));
    const res = await summarizeMedicalCase({ astronautId: "ayla-reyes", locale: "en" });
    expect(res).toEqual({ status: "empty", locale: "en" });
  });

  it("red finding + model says no review → effective review true and medical.review.requested published", async () => {
    setClinicalFetch(clinicalFetch([{ ...FINDING, severity: "red" }]));
    setSessionFactory((async () => ({ prompt: async () => CASE_JSON, dispose: () => {} })) as never);

    const res = await summarizeMedicalCase({ astronautId: "ayla-reyes", locale: "en" });
    expect(res.status).toBe("ok");
    if (res.status !== "ok") return;
    expect(res.requiresMedicalReview).toBe(true);
    const reviewEvents = published.filter((p) => p.topic === "medical.review.requested");
    expect(reviewEvents).toHaveLength(1);
    expect(reviewEvents[0]!.astronautId).toBe("ayla-reyes");
    expect((reviewEvents[0]!.payload as { reason: string }).reason).toBe("officer synthesis flagged review");
  });

  it("no review needed → medical.review.requested not published", async () => {
    setClinicalFetch(clinicalFetch([FINDING]));
    setSessionFactory((async () => ({ prompt: async () => CASE_JSON, dispose: () => {} })) as never);

    await summarizeMedicalCase({ astronautId: "ayla-reyes", locale: "en" });
    expect(published.filter((p) => p.topic === "medical.review.requested")).toHaveLength(0);
  });

  it("unknown astronaut → unavailable", async () => {
    setClinicalFetch(clinicalFetch([FINDING]));
    const res = await summarizeMedicalCase({ astronautId: "nope-unknown", locale: "en" });
    expect(res).toEqual({ status: "unavailable" });
  });
});
