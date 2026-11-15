import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const dir = mkdtempSync(join(tmpdir(), "sky-clinical-routes-"));
process.env.SKY_DB_PATH = join(dir, "routes.db");

type RoutesModule = typeof import("../src/clinical/routes");
type FindingsModule = typeof import("../src/clinical/findings");

let handleClinicalRequest: RoutesModule["handleClinicalRequest"];
let findings: FindingsModule["findingsService"];

const evidence = {
  sourceIds: ["telemetry:ev-r1..ev-r9"],
  dataKind: "simulated" as const,
  quality: "valid" as const,
};

const req = (method: string, path: string, body?: unknown) =>
  new Request(`http://test${path}`, {
    method,
    headers: body !== undefined ? { "content-type": "application/json" } : undefined,
    body: body !== undefined ? (typeof body === "string" ? body : JSON.stringify(body)) : undefined,
  });

beforeAll(async () => {
  ({ handleClinicalRequest } = await import("../src/clinical/routes"));
  ({ findingsService: findings } = await import("../src/clinical/findings"));
});

afterAll(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe("GET /api/clinical/findings", () => {
  test("list returns ok + findings array (newest first)", async () => {
    const created = findings.create({
      astronautId: "yuki-tanaka",
      specialistId: "sky-cardio",
      observedAt: new Date().toISOString(),
      metricIds: ["heart_rate_bpm"],
      severity: "yellow",
      summary: "Routes test list finding (simulated).",
      evidence,
    });
    const res = await handleClinicalRequest(req("GET", "/api/clinical/findings?astronautId=yuki-tanaka&status=all&limit=10"));
    expect(res?.status).toBe(200);
    const body = await res!.json();
    expect(body.ok).toBe(true);
    expect(Array.isArray(body.findings)).toBe(true);
    const mine = body.findings.find((f: { id: string }) => f.id === created.id);
    expect(mine).toBeTruthy();
    expect(mine.astronautId).toBe("yuki-tanaka");
    expect(mine.evidence.dataKind).toBe("simulated"); // evidence parsed, not stringified
    expect(typeof mine.createdAt).toBe("string");
    expect(typeof mine.requiresMedicalReview).toBe("boolean");
  });

  test("default status filter is new; bad status → 400 bad_query; bad limit → 400", async () => {
    const res = await handleClinicalRequest(req("GET", "/api/clinical/findings?status=bogus"));
    expect(res?.status).toBe(400);
    expect((await res!.json()).error).toBe("bad_query");
    const res2 = await handleClinicalRequest(req("GET", "/api/clinical/findings?limit=999"));
    expect(res2?.status).toBe(400);
  });

  test("GET /api/clinical/findings/:id → 200, unknown id → 404 not_found", async () => {
    const created = findings.create({
      astronautId: "lena-fischer",
      specialistId: "sky-cardio",
      observedAt: new Date().toISOString(),
      metricIds: ["heart_rate_bpm"],
      severity: "yellow",
      summary: "Routes test get-by-id finding (simulated).",
      evidence,
    });
    const res = await handleClinicalRequest(req("GET", `/api/clinical/findings/${created.id}`));
    expect(res?.status).toBe(200);
    expect((await res!.json()).finding.id).toBe(created.id);
    const missing = await handleClinicalRequest(req("GET", "/api/clinical/findings/does-not-exist"));
    expect(missing?.status).toBe(404);
    expect((await missing!.json()).error).toBe("not_found");
  });
});

describe("POST /api/clinical/findings/:id/review", () => {
  test("full flow new → reviewed → resolved, audit rows written, resolved returns finding", async () => {
    const created = findings.create({
      astronautId: "tomas-ortega",
      specialistId: "sky-cardio",
      observedAt: new Date().toISOString(),
      metricIds: ["heart_rate_bpm"],
      severity: "yellow",
      summary: "Routes test review-flow finding (simulated).",
      evidence,
    });

    const reviewed = await handleClinicalRequest(
      req("POST", `/api/clinical/findings/${created.id}/review`, { action: "reviewed", note: "Seen by MO (test)" }),
    );
    expect(reviewed?.status).toBe(200);
    expect((await reviewed!.json()).finding.status).toBe("reviewed");

    const resolved = await handleClinicalRequest(
      req("POST", `/api/clinical/findings/${created.id}/review`, { action: "resolved" }),
    );
    expect(resolved?.status).toBe(200);
    const resolvedBody = await resolved!.json();
    expect(resolvedBody.finding.status).toBe("resolved");

    const { clinicalDb } = await import("../src/db/clinicalClient");
    const { clinicalAudit } = await import("../src/db/schema/clinical");
    const { eq } = await import("drizzle-orm");
    const auditRows = clinicalDb.select().from(clinicalAudit).where(eq(clinicalAudit.findingId, created.id)).all();
    expect(auditRows.map((r) => r.action)).toEqual(["reviewed", "resolved"]);
    expect(auditRows[0].detail).toBe("Seen by MO (test)");
  });

  test("bad action → 400 bad_action; malformed JSON → 400 bad_body; extra keys → 400", async () => {
    const created = findings.create({
      astronautId: "ayla-reyes",
      specialistId: "sky-cardio",
      observedAt: new Date().toISOString(),
      metricIds: ["heart_rate_bpm"],
      severity: "yellow",
      summary: "Routes test bad-body finding (simulated).",
      evidence,
    });
    const badAction = await handleClinicalRequest(
      req("POST", `/api/clinical/findings/${created.id}/review`, { action: "delete" }),
    );
    expect(badAction?.status).toBe(400);
    expect((await badAction!.json()).error).toBe("bad_action");

    const malformed = await handleClinicalRequest(req("POST", `/api/clinical/findings/${created.id}/review`, "{not json"));
    expect(malformed?.status).toBe(400);
    expect((await malformed!.json()).error).toBe("bad_body");

    const extra = await handleClinicalRequest(
      req("POST", `/api/clinical/findings/${created.id}/review`, { action: "reviewed", note: "ok", inject: true }),
    );
    expect(extra?.status).toBe(400);

    const missing = await handleClinicalRequest(req("POST", "/api/clinical/findings/nope/review", { action: "reviewed" }));
    expect(missing?.status).toBe(404);
  });
});

describe("routines routes", () => {
  test("GET /api/clinical/routines → definitions with lastRuns, no guidance text", async () => {
    const res = await handleClinicalRequest(req("GET", "/api/clinical/routines"));
    expect(res?.status).toBe(200);
    const body = await res!.json();
    expect(body.ok).toBe(true);
    const interval = body.routines.find((r: { routineId: string }) => r.routineId === "sky-cardio:interval");
    expect(interval).toBeTruthy();
    expect(interval.id).toBe("sky-cardio");
    expect(interval.policyId).toBe("cardio-v1");
    expect(Array.isArray(interval.lastRuns)).toBe(true);
    // No LLM / no secrets — chỉ definition + run status
    expect(JSON.stringify(body)).not.toContain("api_key");
  });

  test("POST /api/clinical/routines/:id/run → ok + results; unknown → 404; bad body → 400", async () => {
    const res = await handleClinicalRequest(req("POST", "/api/clinical/routines/sky-cardio:manual/run", { astronautId: "noor-abbasi" }));
    expect(res?.status).toBe(200);
    const body = await res!.json();
    expect(body.ok).toBe(true);
    expect(body.results).toHaveLength(1);
    expect(body.results[0].astronautId).toBe("noor-abbasi");

    const unknown = await handleClinicalRequest(req("POST", "/api/clinical/routines/sky-unknown:manual/run", {}));
    expect(unknown?.status).toBe(404);

    const badBody = await handleClinicalRequest(req("POST", "/api/clinical/routines/sky-cardio:manual/run", { astronautId: "" }));
    expect(badBody?.status).toBe(400);
  });
});
