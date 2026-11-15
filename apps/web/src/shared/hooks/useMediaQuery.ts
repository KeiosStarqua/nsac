import { useSyncExternalStore } from "react";

/**
 * Generic SSR-safe matchMedia probe. `false` on the server and in the first
 * client snapshot pass is avoided: `useSyncExternalStore` reads the real
 * client value during hydration, so there is no post-mount flash for
 * touch-layout swaps (unlike a useEffect-based probe).
 */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onStoreChange) => {
      const mql = window.matchMedia(query);
      mql.addEventListener("change", onStoreChange);
      return () => mql.removeEventListener("change", onStoreChange);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}
