import { useEffect, useState } from "react";
import { getHudUiPublicFn } from "./api/hud-ui.functions";
import type { HudUi } from "./api/hud-ui.functions";

/**
 * The `/` console variant chosen by the admin on `/admin/ui`.
 *
 * SSR and first paint always return `mock` (the backend default), so the markup is stable and
 * there is no hydration mismatch; after mount the public server function is asked once and the
 * screen switches to `gen` when that is what the admin saved. Any failure leaves `mock`.
 *
 * `?arch=openui` is a per-load dev override handled by the route, not here — it wins when present.
 */
export function useHudUi(): HudUi {
  const [ui, setUi] = useState<HudUi>("mock");

  useEffect(() => {
    let cancelled = false;
    getHudUiPublicFn()
      .then((r) => {
        if (!cancelled && r.ui === "gen") setUi("gen");
      })
      .catch(() => {
        /* never throws by contract; keep the default if it ever does */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return ui;
}
