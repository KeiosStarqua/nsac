// Clinical HTTP routes — handleClinicalRequest(req): Promise<Response | null>.
// Wire ở server.ts: sau sensors, trước health. Mọi lỗi JSON { ok: false, error }.
// Zod-validate mọi input; Content-Length cap như các route hiện có.

import { z } from "zod";
import { MEDICAL_AGENTS, routineIdOf } from "./agents";
import { findingsService } from "./findings";
import { FINDING_STATUSES } from "./types";
import { crewIds, lastRunsFor, runManualRoutine } from "./scheduler";

const MAX_BODY_BYTES = 4096; // 4 KB — clinical payloads nhỏ cố ý

function safeJsonParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

function tooLarge(req: Request): boolean {
  const declared = Number(req.headers.get("content-length"));
  return Number.isFinite(declared) && declared > MAX_BODY_BYTES;
}

const listQuerySchema = z.object({
  astronautId: z.string().trim().min(1).max(64).optional(),
  status: z.enum([...FINDING_STATUSES, "all"]).default("new"),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

const reviewBodySchema = z
  .object({
    action: z.enum(["reviewed", "resolved"]),
    note: z.string().max(300).optional(),
  })
  .strict();

const manualRunBodySchema = z
  .object({
    astronautId: z.string().trim().min(1).max(64).optional(),
  })
  .strict();

export async function handleClinicalRequest(req: Request): Promise<Response | null> {
  const url = new URL(req.url);
  const path = url.pathname;

  // GET /api/clinical/findings — list (newest first)
  if (path === "/api/clinical/findings" && req.method === "GET") {
    const parsed = listQuerySchema.safeParse({
      astronautId: url.searchParams.get("astronautId") ?? undefined,
      status: url.searchParams.get("status") ?? undefined,
      limit: url.searchParams.get("limit") ?? undefined,
    });
    if (!parsed.success) {
      return Response.json({ ok: false, error: "bad_query" }, { status: 400 });
    }
    const findings = findingsService.list(parsed.data);
    return Response.json({ ok: true, findings });
  }

  // GET /api/clinical/findings/:id
  const findingMatch = path.match(/^\/api\/clinical\/findings\/([^/]+)$/);
  if (findingMatch && req.method === "GET") {
    const finding = findingsService.get(decodeURIComponent(findingMatch[1]));
    if (!finding) {
      return Response.json({ ok: false, error: "not_found" }, { status: 404 });
    }
    return Response.json({ ok: true, finding });
  }

  // POST /api/clinical/findings/:id/review — review/ack ONLY. Không có medical action endpoint.
  const reviewMatch = path.match(/^\/api\/clinical\/findings\/([^/]+)\/review$/);
  if (reviewMatch && req.method === "POST") {
    if (tooLarge(req)) {
      return Response.json({ ok: false, error: "too_large" }, { status: 413 });
    }
    const text = await req.text();
    if (new TextEncoder().encode(text).length > MAX_BODY_BYTES) {
      return Response.json({ ok: false, error: "too_large" }, { status: 413 });
    }
    const body = safeJsonParse(text);
    if (body === undefined) {
      return Response.json({ ok: false, error: "bad_body" }, { status: 400 });
    }
    // Tách action ra kiểm tra riêng để trả bad_action khi đúng chỉ action sai.
    const rawAction = (body as Record<string, unknown> | null)?.action;
    if (typeof rawAction !== "string" || (rawAction !== "reviewed" && rawAction !== "resolved")) {
      return Response.json({ ok: false, error: "bad_action" }, { status: 400 });
    }
    const parsed = reviewBodySchema.safeParse(body);
    if (!parsed.success) {
      return Response.json({ ok: false, error: "bad_body" }, { status: 400 });
    }
    const id = decodeURIComponent(reviewMatch[1]);
    const finding = findingsService.review(id, parsed.data.action, parsed.data.note);
    if (!finding) {
      return Response.json({ ok: false, error: "not_found" }, { status: 404 });
    }
    return Response.json({ ok: true, finding });
  }

  // GET /api/clinical/routines — definitions + last run per astronaut. No secrets, no guidance.
  if (path === "/api/clinical/routines" && req.method === "GET") {
    const crew = await crewIds();
    const routines = MEDICAL_AGENTS.flatMap((agent) =>
      agent.routines.map((routine) => {
        const routineId = routineIdOf(agent.id, routine.kind);
        return {
          ...agent,
          routineId,
          routine,
          lastRuns: lastRunsFor(routineId, crew),
        };
      }),
    );
    return Response.json({ ok: true, routines });
  }

  // POST /api/clinical/routines/:id/run — manual trigger; cooldown vẫn áp dụng.
  const runMatch = path.match(/^\/api\/clinical\/routines\/([^/]+)\/run$/);
  if (runMatch && req.method === "POST") {
    if (tooLarge(req)) {
      return Response.json({ ok: false, error: "too_large" }, { status: 413 });
    }
    const text = await req.text();
    if (new TextEncoder().encode(text).length > MAX_BODY_BYTES) {
      return Response.json({ ok: false, error: "too_large" }, { status: 413 });
    }
    const body = text.trim().length === 0 ? {} : safeJsonParse(text);
    if (body === undefined) {
      return Response.json({ ok: false, error: "bad_body" }, { status: 400 });
    }
    const parsed = manualRunBodySchema.safeParse(body);
    if (!parsed.success) {
      return Response.json({ ok: false, error: "bad_body" }, { status: 400 });
    }
    const routineId = decodeURIComponent(runMatch[1]);
    const known = MEDICAL_AGENTS.flatMap((a) => a.routines.map((r) => routineIdOf(a.id, r.kind)));
    if (!known.includes(routineId)) {
      return Response.json({ ok: false, error: "not_found" }, { status: 404 });
    }
    // Forced manual run của bất kỳ routine id nào; cooldown vẫn áp dụng (không bypass).
    const crew = parsed.data.astronautId ? [parsed.data.astronautId] : await crewIds();
    const results = runManualRoutine(routineId, crew, new Date());
    if (!results) {
      return Response.json({ ok: false, error: "not_found" }, { status: 404 });
    }
    return Response.json({ ok: true, results });
  }

  return null;
}
