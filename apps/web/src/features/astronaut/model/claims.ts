import { z } from "zod";

export interface ClaimEntry {
  readonly astronautId: string;
  readonly mine: boolean;
}

const ClaimEntrySchema = z.object({
  astronautId: z.string().trim().min(1),
  mine: z.boolean(),
});

/**
 * Lenient: non-array → [], entries failing the schema are dropped, duplicates keep the first.
 * Never throws — a hostile or garbled backend payload must not break the picker.
 */
export function parseClaims(input: unknown): ClaimEntry[] {
  if (!Array.isArray(input)) return [];
  const seen = new Set<string>();
  const out: ClaimEntry[] = [];
  for (const item of input) {
    const parsed = ClaimEntrySchema.safeParse(item);
    if (!parsed.success) continue;
    if (seen.has(parsed.data.astronautId)) continue;
    seen.add(parsed.data.astronautId);
    out.push({ astronautId: parsed.data.astronautId, mine: parsed.data.mine });
  }
  return out;
}

/**
 * Body của `GET /api/claims`. Bản force-release trả `{ claims, epoch }`; bản cũ trả mảng trần —
 * vẫn đọc được, chỉ là không có epoch (null ⇒ không bao giờ kick). Garbage → rỗng, epoch null;
 * không bao giờ throw.
 */
export function parseClaimsState(input: unknown): { claims: ClaimEntry[]; epoch: number | null } {
  if (Array.isArray(input)) return { claims: parseClaims(input), epoch: null };
  if (typeof input !== "object" || input === null) return { claims: [], epoch: null };
  const record = input as { claims?: unknown; epoch?: unknown };
  if (!Array.isArray(record.claims)) return { claims: [], epoch: null };
  const raw = record.epoch;
  const epoch =
    typeof raw === "number" && Number.isInteger(raw) && raw >= 0 ? raw : null;
  return { claims: parseClaims(record.claims), epoch };
}

/**
 * Crew ids held by *other* sessions. My own claim is excluded (re-claiming it is always
 * allowed); the optional `mineAstronautId` restates that when no `mine` flag is available
 * (e.g. before the first refresh).
 */
export function takenIdsOf(
  claims: readonly ClaimEntry[],
  mineAstronautId?: string | null,
): ReadonlySet<string> {
  const taken = new Set<string>();
  for (const claim of claims) {
    if (claim.mine) continue;
    taken.add(claim.astronautId);
  }
  if (mineAstronautId) taken.delete(mineAstronautId);
  return taken;
}
