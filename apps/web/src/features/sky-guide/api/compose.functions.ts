import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { LocaleSchema } from "~/shared/i18n";
import { StationIdSchema } from "~/shared/sky";
import { composeStation } from "./compose.server";

// Strict at the trust boundary: an unknown station or locale is rejected, never guessed.
const ComposeInput = z.object({ station: StationIdSchema, locale: LocaleSchema });

/** Streams the local model's panel for one station as typed events. */
export const streamStationPanel = createServerFn({ method: "POST" })
  .validator(ComposeInput)
  .handler(async function* ({ data }) {
    yield* composeStation(data.station, data.locale);
  });
