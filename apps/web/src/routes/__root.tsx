import {
  HeadContent,
  Link,
  Outlet,
  Scripts,
  createRootRoute,
  useRouterState,
} from "@tanstack/react-router";
import type { ReactNode } from "react";
import { z } from "zod";
import { SkyGuideProvider } from "~/features/sky-guide";
import { LocaleSchema, getCopy, getRequestLocale, useCopy, type Locale } from "~/shared/i18n";
import { Footer, Header } from "~/shared/layout";
import appCss from "~/styles/global.css?url";

export const Route = createRootRoute({
  // `?lang=` is the single source of truth for language. A malformed value falls back to detection.
  validateSearch: z.object({ lang: LocaleSchema.optional().catch(undefined) }),
  // Runs on the server for the first request (so SSR HTML already has the right language)
  // and on the client for later navigations. Accept-Language is only read when the URL has no `lang`.
  beforeLoad: async ({ search }): Promise<{ locale: Locale }> => ({
    locale: search.lang ?? (await getRequestLocale()),
  }),
  head: ({ match }) => {
    const copy = getCopy(match.context.locale);
    return {
      meta: [
        { charSet: "utf-8" },
        { name: "viewport", content: "width=device-width, initial-scale=1" },
        { name: "theme-color", content: "#070b14" },
        { name: "color-scheme", content: "dark" },
        { title: copy.meta.title },
        { name: "description", content: copy.meta.description },
      ],
      links: [
        { rel: "stylesheet", href: appCss },
        { rel: "icon", type: "image/svg+xml", href: "/favicon.svg" },
      ],
    };
  },
  shellComponent: RootShell,
  component: RootLayout,
  notFoundComponent: NotFound,
});

/** Always server-rendered: the `<html>` document that wraps every route, whatever its SSR mode. */
function RootShell({ children }: { children: ReactNode }) {
  const rawLocale = useRouterState({ select: (state) => state.matches[0]?.context });
  const parsed = LocaleSchema.safeParse((rawLocale as { locale?: unknown } | undefined)?.locale);
  return (
    <html lang={parsed.success ? parsed.data : "en"}>
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootLayout() {
  const copy = useCopy();
  // Sky flies over every page: the provider hosts it and the stations each route places.
  return (
    <SkyGuideProvider>
      <a className="skip-link" href="#main">
        {copy.nav.skip}
      </a>
      <Header />
      <main id="main">
        <Outlet />
      </main>
      <Footer />
    </SkyGuideProvider>
  );
}

function NotFound() {
  return (
    <div style={{ padding: "96px 24px", textAlign: "center" }}>
      <h1>404</h1>
      <p style={{ margin: "12px 0 24px", color: "var(--muted)" }}>This page does not exist.</p>
      <Link to="/" search={(prev) => prev}>
        Home
      </Link>
    </div>
  );
}
