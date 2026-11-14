import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const sendChat = createServerFn({ method: "POST" })
  .validator(z.object({ astronautId: z.string(), message: z.string() }))
  .handler(async ({ data }) => {
    const m = await import("../runtime/astro-chat.server");
    return m.sendChatTurn(data.astronautId, data.message);
  });

export const loadChatHistory = createServerFn({ method: "POST" })
  .validator(z.object({ astronautId: z.string() }))
  .handler(async ({ data }) => {
    const m = await import("../runtime/astro-chat.server");
    return m.loadChatHistory(data.astronautId);
  });