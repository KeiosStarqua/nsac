import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const dir = mkdtempSync(join(tmpdir(), "sky-clinical-events-"));
process.env.SKY_DB_PATH = join(dir, "events.db");

type FindingsModule = typeof import("../src/clinical/findings");
type EventsClientModule = typeof import("../src/db/eventsClient");
type EventsSchemaModule = typeof import("../src/db/schema/changeEvents");

let findings: FindingsModule["findingsService"];
let eventsDb: EventsClientModule["eventsDb"];
let changeEvents: EventsSchemaModule["changeEvents"];
let eq: typeof import("drizzle-orm")["eq"];

const evidence = {
  sourceIds: ["telemetry:ev-1..ev-9"],
  dataKind: "simulated" as const,
  quality: "valid" as const,
};

beforeAll(async () => {
  ({ findingsService: findings } = await import("../src/clinical/findings"));
  ({ eventsDb } = await import("../src/db/eventsClient"));
  ({ changeEvents } = await import("../src/db/schema/changeEvents"));
  ({ eq } = await import("drizzle-orm"));
});

afterAll(() => {
  rmSync(dir, { recursive: true, force: true });
});

function eventsOfTopic(topic: string) {
  return eventsDb.select().from(changeEvents).where(eq(changeEvents.topic, topic)).all();
}

describe("medical event topics", () => {
  test("finding creation publishes medical.finding.created with correct payload", () => {
    const finding = findings.create({
      astronautId: "yuki-tanaka",
      specialistId: "sky-cardio",
      observedAt: new Date().toISOString(),
      metricIds: ["heart_rate_bpm"],
      severity: "yellow",
      summary: "Events test finding (simulated).",
      evidence,
    });
    const rows = eventsOfTopic("medical.finding.created");
    const match = rows.find((r) => {
      try {
        return JSON.parse(r.payload).findingId === finding.id;
      } catch {
        return false;
      }
    });
    expect(match).toBeTruthy();
    const payload = JSON.parse(match!.payload);
    expect(payload.specialistId).toBe("sky-cardio");
    expect(payload.severity).toBe("yellow");
    expect(payload.requiresMedicalReview).toBe(true);
    expect(match!.astronautId).toBe("yuki-tanaka");
    expect(match!.source).toBe("sky-cardio");
  });

  test("review resolved publishes medical.finding.resolved with action=resolved", () => {
    const finding = findings.create({
      astronautId: "tomas-ortega",
      specialistId: "sky-cardio",
      observedAt: new Date().toISOString(),
      metricIds: ["heart_rate_bpm"],
      severity: "yellow",
      summary: "Events test finding for resolved path (simulated).",
      evidence,
    });
    findings.review(finding.id, "resolved", "Acknowledged by test");
    const rows = eventsOfTopic("medical.finding.resolved");
    const match = rows.find((r) => {
      try {
        return JSON.parse(r.payload).findingId === finding.id;
      } catch {
        return false;
      }
    });
    expect(match).toBeTruthy();
    expect(JSON.parse(match!.payload).action).toBe("resolved");
  });

  test("finding persists and create() does not throw when publish path is exercised", () => {
    // Publish failure không rollback finding là bảo đảm thiết kế (try/catch quanh publish);
    // không inject được lỗi insert mà không có DI seam — assert contract: không throw + row tồn tại.
    let finding: ReturnType<typeof findings.create> | undefined;
    expect(() => {
      finding = findings.create({
        astronautId: "noor-abbasi",
        specialistId: "sky-cardio",
        observedAt: new Date().toISOString(),
        metricIds: ["heart_rate_bpm"],
        severity: "red",
        summary: "Events test finding for persist-resilience check (simulated).",
        evidence,
      });
    }).not.toThrow();
    expect(finding?.id).toBeTruthy();
    expect(findings.get(finding!.id)?.severity).toBe("red");
  });
});
