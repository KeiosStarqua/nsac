import { useCallback, useEffect, useState } from "react";
import type { PerformanceTier } from "../domain";

export function usePerformanceTier(): { tier: PerformanceTier; setTier: (t: PerformanceTier) => void } {
  const [tier, setTierState] = useState<PerformanceTier>("balanced");
  const setTier = useCallback((t: PerformanceTier) => setTierState(t), []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ?? false;
    const saveData = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData ?? false;
    const dm = (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 4;
    let next: PerformanceTier = "balanced";
    if (reduced || saveData || dm < 2) next = "low";
    else if (dm >= 8 && !reduced) next = "high";
    setTierState(next);
  }, []);

  return { tier, setTier };
}