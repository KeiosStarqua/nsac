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
import { LocaleSchema, getCopy, getRequestLocale, type Locale } from "~/shared/i18n";
import appCss from "~/styles/global.css?url";

export const Route = createRootRoute({
  validateSearch: z.object({ lang: LocaleSchema.optional().catch(undefined) }),
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

function RootShell({ children }: { children: ReactNode }) {
  const rawLocale = useRouterState({ select: (state) => state.matches[0]?.context });
  const parsed = LocaleSchema.safeParse((rawLocale as { locale?: unknown } | undefined)?.locale);
  return (
    <html lang={parsed.success ? parsed.data : "en"} data-theme="dark">
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
  return <Outlet />;
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
