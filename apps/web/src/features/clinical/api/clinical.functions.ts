import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { DEFAULT_ASTRONAUT_ID } from "../../astronaut/model/astronauts";
import type { ClinicalFinding } from "../model/findings";
import type { MedicalOfficerResult } from "../../agent/runtime/medical-officer.server";

const astronautIdSchema = z.string().trim().min(1).max(64);
const localeSchema = z.enum(["en", "vi"]).catch("en");
const findingIdSchema = z.string().trim().min(1).max(64);
const reviewActionSchema = z.enum(["reviewed", "resolved"]);

export type ClinicalFindingsResult =
  | { ok: true; findings: ClinicalFinding[] }
  | { ok: false; error: "unavailable" };

export type ClinicalReviewResult =
  | { ok: true; finding: ClinicalFinding }
  | { ok: false; error: "not_found" | "bad_request" | "unavailable" };

/**
 * Open findings (new + reviewed) for an astronaut, newest first. The backend may be down —
 * that resolves `{ ok: false, error: "unavailable" }`, never an exception and never fake data.
 * Invalid astronaut ids fall back to the default crew member (mirrors getPerformance).
 */
export const listClinicalFindingsFn = createServerFn({ method: "POST" })
  .validator((data?: { astronautId?: unknown }) => {
    const parsed = astronautIdSchema.safeParse(data?.astronautId);
    return { astronautId: parsed.success ? parsed.data : DEFAULT_ASTRONAUT_ID };
  })
  .handler(async ({ data }): Promise<ClinicalFindingsResult> => {
    const { fetchClinicalFindings } = await import("../runtime/backend");
    const findings = await fetchClinicalFindings({
      astronautId: data.astronautId,
      status: "all",
      limit: 50,
      openOnly: true,
    });
    if (findings === null) return { ok: false, error: "unavailable" };
    return { ok: true, findings };
  });

/** One-shot synthesis of the astronaut's open findings by the sky-medical-officer. */
export const summarizeMedicalCaseFn = createServerFn({ method: "POST" })
  .validator((data?: { astronautId?: unknown; locale?: unknown }) => {
    const parsed = astronautIdSchema.safeParse(data?.astronautId);
    return {
      astronautId: parsed.success ? parsed.data : DEFAULT_ASTRONAUT_ID,
      locale: localeSchema.parse(data?.locale),
    };
  })
  .handler(async ({ data }): Promise<MedicalOfficerResult> => {
    const { summarizeMedicalCase } = await import("../../agent/runtime/medical-officer.server");
    return summarizeMedicalCase({ astronautId: data.astronautId, locale: data.locale });
  });

/** Mark a finding reviewed or resolved. 404/400 map to typed errors; optimistic UI rolls back. */
export const acknowledgeFindingFn = createServerFn({ method: "POST" })
  .validator((data?: { id?: unknown; action?: unknown }) => {
    const id = findingIdSchema.safeParse(data?.id);
    const action = reviewActionSchema.safeParse(data?.action);
    return {
      id: id.success ? id.data : null,
      action: action.success ? action.data : null,
    };
  })
  .handler(async ({ data }): Promise<ClinicalReviewResult> => {
    if (!data.id || !data.action) return { ok: false, error: "bad_request" };
    const { postClinicalReview } = await import("../runtime/backend");
    return postClinicalReview({ id: data.id, action: data.action });
  });
