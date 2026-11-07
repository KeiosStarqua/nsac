import { getRouteApi } from "@tanstack/react-router";
import { en } from "./en";
import type { Locale } from "./locale";
import type { Copy } from "./types";
import { vi } from "./vi";

const COPY: Readonly<Record<Locale, Copy>> = { en, vi };

export function getCopy(locale: Locale): Copy {
  return COPY[locale];
}

const rootRoute = getRouteApi("__root__");

/** The locale resolved by the root route's `beforeLoad` (URL `?lang=` first, then Accept-Language). */
export function useLocale(): Locale {
  return rootRoute.useRouteContext({ select: (context) => context.locale });
}

export function useCopy(): Copy {
  return getCopy(useLocale());
}
