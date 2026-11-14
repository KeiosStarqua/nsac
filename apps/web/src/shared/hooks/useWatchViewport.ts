import { useEffect, useState } from "react";

const WATCH_QUERY = "(max-width: 480px)";

/**
 * SSR-safe viewport probe for the watch/small-device layout.
 * Returns `false` on the server and before mount; after mount it tracks
 * `matchMedia("(max-width: 480px)")` live via a `change` listener.
 */
export function useWatchViewport(): boolean {
  const [isWatch, setIsWatch] = useState(false);
  useEffect(() => {
    const mql = window.matchMedia(WATCH_QUERY);
    const onChange = () => setIsWatch(mql.matches);
    onChange();
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);
  return isWatch;
}
