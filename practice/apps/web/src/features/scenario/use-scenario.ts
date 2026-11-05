import { useNavigate, useSearch } from "@tanstack/react-router";
import { useCallback } from "react";
import { INTERVENTION_PATTERN } from "@practice/sim";
import { HORIZON, type ScenarioSearch } from "~/shared/scenario/search";

/**
 * Typed access to the scenario that lives in the URL (seed, day, iv), plus the only ways to change it.
 * Pages never build search params by hand; they call these.
 */
export function useScenario() {
  const search = useSearch({ from: "/_ship" });
  const navigate = useNavigate();

  const go = useCallback(
    (next: Partial<ScenarioSearch>, options: { replace?: boolean } = {}) =>
      navigate({ to: ".", search: { ...search, ...next }, replace: options.replace }),
    [navigate, search],
  );

  const setDay = useCallback(
    (day: number) => go({ day: Math.max(0, Math.min(HORIZON, day)) }, { replace: true }),
    [go],
  );

  /** A new seed is a new story, so confirmed actions and the day reset with it. */
  const setSeed = useCallback((seed: number) => go({ seed, day: 0, iv: [] }), [go]);

  /**
   * The single place a proposed action becomes real. The AI only proposes; this runs
   * after the astronaut presses a button. The action starts tomorrow, so we step one day forward.
   */
  const confirmIntervention = useCallback(
    (interventionId: string): boolean => {
      const token = `${search.day + 1}:${interventionId}`;
      if (!INTERVENTION_PATTERN.test(token) || search.iv.includes(token)) return false;
      void go({ iv: [...search.iv, token], day: Math.min(HORIZON, search.day + 1) });
      return true;
    },
    [go, search.day, search.iv],
  );

  const undoLast = useCallback(() => go({ iv: search.iv.slice(0, -1) }), [go, search.iv]);
  const clearActions = useCallback(() => go({ iv: [] }), [go]);

  return { ...search, setDay, setSeed, confirmIntervention, undoLast, clearActions };
}
