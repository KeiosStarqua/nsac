import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { saveOpenRouterKey } from "./key.server";

const SaveInput = z.object({ key: z.string().min(1).max(4096) });

export const saveOpenRouterKeyFn = createServerFn({ method: "POST" })
  .validator(SaveInput)
  .handler(async ({ data }) => saveOpenRouterKey(data.key));
