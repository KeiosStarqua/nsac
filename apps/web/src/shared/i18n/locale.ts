import { z } from "zod";

export const LOCALES = ["en", "vi"] as const;
export const LocaleSchema = z.enum(LOCALES);
export type Locale = z.infer<typeof LocaleSchema>;

/** Pick `vi` when the browser's most-preferred language is Vietnamese, otherwise `en`. */
export function resolveLocale(acceptLanguage: string | null | undefined): Locale {
  const first = acceptLanguage?.split(",")[0]?.trim().toLowerCase() ?? "";
  return first.startsWith("vi") ? "vi" : "en";
}
