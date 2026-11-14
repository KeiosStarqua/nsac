const STORAGE_KEY = "nsac.chunk-recovery";
const GUARD_MS = 15_000;

export function shouldRecover(lastReloadAt: number, now: number): boolean {
  if (lastReloadAt <= 0) return true;
  return now - lastReloadAt > GUARD_MS;
}

export function recoverFromChunkError(): void {
  try {
    const now = Date.now();
    let lastReloadAt = 0;
    try {
      const raw = window.sessionStorage.getItem(STORAGE_KEY);
      lastReloadAt = raw ? Number(raw) : 0;
    } catch {
      lastReloadAt = 0;
    }
    if (!shouldRecover(lastReloadAt, now)) return;
    try {
      window.sessionStorage.setItem(STORAGE_KEY, String(now));
    } catch {
      // Safari private mode throws; ignore.
    }
    window.location.reload();
  } catch {
    // SSR or no window; ignore.
  }
}

export function installChunkRecovery(): () => void {
  if (typeof window === "undefined") return () => {};
  const handler = (event: Event) => {
    event.preventDefault();
    recoverFromChunkError();
  };
  window.addEventListener("vite:preloadError", handler);
  return () => window.removeEventListener("vite:preloadError", handler);
}