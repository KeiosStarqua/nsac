import { useEffect, useState } from "react";
import { getHudBackgroundPublicFn } from "./api/hud-background.functions";
import type { HudBackground } from "./api/hud-background.functions";

/**
 * The console backdrop chosen by the admin on `/admin/background`.
 *
 * SSR and first paint always return `particles` (the backend default), so the markup is stable and
 * there is no hydration mismatch; after mount the public server function is asked once and the
 * screen switches to `galaxy` when that is what the admin saved. Any failure leaves `particles`.
 *
 * The retired `?bg=` / `localStorage["nsac.bg"]` mechanism is gone — admin always wins — and the
 * stale key is dropped here (one-way cleanup).
 */
export function useHudBackground(): HudBackground {
  const [background, setBackground] = useState<HudBackground>("particles");

  useEffect(() => {
    let cancelled = false;
    try {
      window.localStorage.removeItem("nsac.bg");
    } catch {
      /* storage unavailable — nothing to clean */
    }
    getHudBackgroundPublicFn()
      .then((r) => {
        if (!cancelled && r.background === "galaxy") setBackground("galaxy");
      })
      .catch(() => {
        /* never throws by contract; keep the default if it ever does */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return background;
}
