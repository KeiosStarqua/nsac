import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const composeHud = createServerFn({ method: "POST" })
  .validator(z.object({ astronautId: z.string().min(1).max(128), locale: z.enum(["en", "vi"]) }))
  .handler(async ({ data }) => {
    const m = await import("../runtime/hud-compose.server");
    return m.composeHud(data.astronautId, data.locale);
  });
