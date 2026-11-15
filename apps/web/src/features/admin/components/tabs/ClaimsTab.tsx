import { useState } from "react";
import { RotateCcw } from "lucide-react";
import { useCopy } from "~/shared/i18n";
import { resetClaimsFn } from "../../api/admin.functions";
import type { ResetClaimsResult } from "../../api/admin.functions";
import { useAdminGate } from "../admin-gate";
import {
  dangerButtonClasses,
  muted,
  sectionCard,
  sectionHeader,
  sectionIcon,
  sectionTitle,
} from "./classes";

type ResetState = { kind: "ok"; cleared: number } | { kind: "error"; message: string } | null;

export function ClaimsTab() {
  const copy = useCopy().admin;
  const { lock } = useAdminGate();

  // Claims reset (demo housekeeping — claims are HUD data, nothing here refreshes)
  const [resetBusy, setResetBusy] = useState(false);
  const [resetState, setResetState] = useState<ResetState>(null);

  async function resetClaims() {
    if (resetBusy) return;
    if (!window.confirm(copy.resetClaimsConfirm)) return;
    setResetBusy(true);
    setResetState(null);
    try {
      const r: ResetClaimsResult = await resetClaimsFn();
      if (r.status === "ok") {
        setResetState({ kind: "ok", cleared: r.cleared });
      } else if (r.status === "unauthorized") {
        lock();
      } else {
        setResetState({ kind: "error", message: copy.resetClaimsFailed });
      }
    } catch {
      setResetState({ kind: "error", message: copy.resetClaimsFailed });
    } finally {
      setResetBusy(false);
    }
  }

  return (
    <section aria-label={copy.resetClaims} className={sectionCard}>
      <div className={sectionHeader}>
        <h2 className={sectionTitle}>
          <RotateCcw aria-hidden className={sectionIcon} strokeWidth={1.75} />
          {copy.resetClaims}
        </h2>
      </div>
      <p className={`${muted} mt-2 max-w-[68ch] text-[12px] leading-5`}>{copy.claimsDescription}</p>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={resetClaims}
          disabled={resetBusy}
          className={dangerButtonClasses}
        >
          {resetBusy ? copy.resetting : copy.resetClaims}
        </button>
        <div aria-live="polite" className="text-[14px]">
          {resetState?.kind === "ok" && (
            <span className="text-(--green)">
              {copy.resetClaimsDone.replace("{count}", String(resetState.cleared))}
            </span>
          )}
          {resetState?.kind === "error" && (
            <span className="text-(--red)">{resetState.message}</span>
          )}
        </div>
      </div>
    </section>
  );
}
