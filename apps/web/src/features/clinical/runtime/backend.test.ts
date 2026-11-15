import { describe, it, expect, afterEach } from "vitest";
import {
  fetchClinicalFindings,
  postClinicalReview,
  reviewHttpStatus,
  setClinicalFetch,
} from "./backend";

const FINDING = {
  id: "f-1",
  astronautId: "ayla-reyes",
  specialistId: "sky-cardio",
  observedAt: "2026-11-15T08:30:00.000Z",
  metricIds: [],
  severity: "yellow",
  status: "new",
  summary: "s",
  evidence: { sourceIds: [], dataKind: "simulated", quality: "valid" },
  requiresMedicalReview: false,
};

const FINDING_RESOLVED = { ...FINDING, id: "f-2", status: "resolved" };

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

function fakeBackend(handler: (url: string, init?: RequestInit) => Response | Promise<Response>) {
  return (async (input: unknown, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : String(input);
    return handler(url, init);
  }) as typeof fetch;
}

afterEach(() => {
  setClinicalFetch(null);
  delete process.env.BACKEND_URL;
});

describe("reviewHttpStatus (acknowledge 404/400 mapping)", () => {
  it("maps statuses", () => {
    expect(reviewHttpStatus(200)).toBe("ok");
    expect(reviewHttpStatus(204)).toBe("ok");
    expect(reviewHttpStatus(400)).toBe("bad_request");
    expect(reviewHttpStatus(404)).toBe("not_found");
    expect(reviewHttpStatus(500)).toBe("unavailable");
  });
});

describe("fetchClinicalFindings", () => {
  it("drops resolved findings and keeps new/reviewed", async () => {
    setClinicalFetch(
      fakeBackend((url) => {
        if (url.includes("/api/clinical/findings")) {
          return jsonResponse(200, { ok: true, findings: [FINDING, FINDING_RESOLVED] });
        }
        return new Response("not found", { status: 404 });
      }),
    );
    const out = await fetchClinicalFindings({ astronautId: "ayla-reyes" });
    expect(out).toHaveLength(1);
    expect(out![0]!.id).toBe("f-1");
  });

  it("strips unknown extra fields instead of failing", async () => {
    const withExtra = { ...FINDING, somethingFuture: { nested: true }, another: "x" };
    setClinicalFetch(fakeBackend(() => jsonResponse(200, { ok: true, findings: [withExtra] })));
    const out = await fetchClinicalFindings({ astronautId: "ayla-reyes" });
    expect(out).toHaveLength(1);
    expect("somethingFuture" in (out![0] as Record<string, unknown>)).toBe(false);
  });

  it("returns null on envelope drift and on network failure", async () => {
    setClinicalFetch(fakeBackend(() => jsonResponse(200, { findings: [FINDING] }))); // missing ok:true
    expect(await fetchClinicalFindings({ astronautId: "ayla-reyes" })).toBeNull();

    setClinicalFetch(
      (async () => {
        throw new Error("boom");
      }) as typeof fetch,
    );
    expect(await fetchClinicalFindings({ astronautId: "ayla-reyes" })).toBeNull();
  });

  it("drops rows that fail validation but keeps valid ones", async () => {
    setClinicalFetch(fakeBackend(() => jsonResponse(200, { ok: true, findings: [FINDING, { bogus: 1 }] })));
    const out = await fetchClinicalFindings({ astronautId: "ayla-reyes" });
    expect(out).toHaveLength(1);
  });
});

describe("postClinicalReview", () => {
  it("404 → not_found, 400 → bad_request, network failure → unavailable", async () => {
    setClinicalFetch(fakeBackend(() => new Response("nope", { status: 404 })));
    expect(await postClinicalReview({ id: "f-1", action: "resolved" })).toEqual({ ok: false, error: "not_found" });

    setClinicalFetch(fakeBackend(() => new Response("nope", { status: 400 })));
    expect(await postClinicalReview({ id: "f-1", action: "reviewed" })).toEqual({ ok: false, error: "bad_request" });

    setClinicalFetch(
      (async () => {
        throw new Error("boom");
      }) as typeof fetch,
    );
    expect(await postClinicalReview({ id: "f-1", action: "resolved" })).toEqual({ ok: false, error: "unavailable" });
  });

  it("200 with a valid finding body → ok", async () => {
    setClinicalFetch(fakeBackend(() => jsonResponse(200, { ok: true, finding: { ...FINDING, status: "resolved" } })));
    const out = await postClinicalReview({ id: "f-1", action: "resolved" });
    expect(out.ok).toBe(true);
    if (out.ok) expect(out.finding.status).toBe("resolved");
  });
});
