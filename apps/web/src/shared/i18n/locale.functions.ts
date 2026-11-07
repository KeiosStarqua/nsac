import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { resolveLocale } from "./locale";

/**
 * Server function: reads the request's Accept-Language header, which only exists on the server.
 * Used by the root route when the URL has no `?lang=`.
 */
export const getRequestLocale = createServerFn({ method: "GET" }).handler(() =>
  resolveLocale(getRequestHeader("accept-language")),
);
