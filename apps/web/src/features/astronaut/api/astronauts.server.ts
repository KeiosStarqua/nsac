import "@tanstack/react-start/server-only";
import { ASTRONAUTS, parseAstronautRows, type Astronaut } from "../model/astronauts";

const REQUEST_TIMEOUT_MS = 1500;
const DEFAULT_BACKEND_URL = "http://127.0.0.1:3200";

/**
 * Read the crew roster from the backend (`GET /api/astronauts`).
 * Any failure (no backend, timeout, bad payload) returns `[]`; the caller keeps the bundled
 * fixture so the picker and the HUD still work with the network unplugged.
 */
export async function fetchBackendAstronauts(): Promise<Astronaut[]> {
  const base = process.env.BACKEND_URL?.trim() || DEFAULT_BACKEND_URL;
  let url: URL;
  try {
    url = new URL("/api/astronauts", base);
  } catch {
    return [];
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { accept: "application/json" },
    });
    if (!res.ok) return [];
    return parseAstronautRows(await res.json());
  } catch {
    return [];
  } finally {
    clearTimeout(timer);
  }
}

export function rosterOrFixture(rows: readonly Astronaut[]): Astronaut[] {
  return rows.length > 0 ? [...rows] : [...ASTRONAUTS];
}
