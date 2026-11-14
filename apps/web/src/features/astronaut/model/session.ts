// Client-only session id for anonymous claim identity: random UUID per browser profile,
// stored in localStorage. Never read server-side; callers only invoke this from mounted
// effects. Private-mode / storage-failure falls back to an in-memory UUID for the session.
const SESSION_STORAGE_KEY = "nsac.session";

let inMemorySessionId: string | null = null;

function createSessionId(): string {
  const cryptoObj = globalThis.crypto;
  if (typeof cryptoObj?.randomUUID === "function") return cryptoObj.randomUUID();
  // Fallback for very old browsers: RFC4122 v4 from getRandomValues.
  const bytes = new Uint8Array(16);
  cryptoObj.getRandomValues(bytes);
  bytes[6] = (bytes[6]! & 0x0f) | 0x40;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = [...bytes].map((b) => b.toString(16).padStart(2, "0"));
  return `${hex.slice(0, 4).join("")}-${hex.slice(4, 6).join("")}-${hex.slice(6, 8).join("")}-${hex.slice(8, 10).join("")}-${hex.slice(10, 16).join("")}`;
}

export function getOrCreateSessionId(): string {
  if (typeof window === "undefined") {
    // SSR safety net — callers should not hit this path.
    inMemorySessionId ??= createSessionId();
    return inMemorySessionId;
  }
  try {
    const stored = window.localStorage.getItem(SESSION_STORAGE_KEY);
    if (stored && stored.trim().length >= 8) return stored.trim();
    const created = createSessionId();
    window.localStorage.setItem(SESSION_STORAGE_KEY, created);
    return created;
  } catch {
    inMemorySessionId ??= createSessionId();
    return inMemorySessionId;
  }
}
