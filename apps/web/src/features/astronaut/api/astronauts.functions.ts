import { createServerFn } from "@tanstack/react-start";
import type { Astronaut } from "../model/astronauts";

/**
 * Crew roster for the picker. Always resolves: when the backend is unavailable the bundled
 * fixture (`ASTRONAUTS`) is returned, so the page keeps working offline.
 */
export const getAstronauts = createServerFn({ method: "GET" }).handler(async (): Promise<Astronaut[]> => {
  const { fetchBackendAstronauts, rosterOrFixture } = await import("./astronauts.server");
  return rosterOrFixture(await fetchBackendAstronauts());
});
