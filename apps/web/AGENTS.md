# apps/web

## Purpose

Landing page for **Sky**, the clinical assistant for astronauts and flight surgeons. Pages: `/` (product description, the two core features, five hazards, data and standards, the detect → recommend → confirm → report loop, demo teaser, story teaser, modules, safety rules, sources), `/demo` (interactive Mars landing readiness), `/story` (the "Sky" story). It is a showcase, not the astronaut's app (that is `apps/onboard`, NiceGUI). On every page Sky (a static angel image) flies over the interface and, at each station it lands on, composes a panel with OpenUI.

## Ownership

- Owns everything under `apps/web/`. The root `package.json`, `turbo.json` and `tsconfig.base.json` belong to the root `AGENTS.md`.
- Concept content comes from the team PRD, `NASA HACKATHON_Prd Description.pdf` at the repo root (local only, `*.pdf` is gitignored): objective, the two core features with their onboarding examples, the five hazards with symptom risks and measurement tools, and the data table. Keep the page in step with it.
- `STORY.md` at the repo root is the only source of the story text. This app renders it; never copy it into `src/`. Edit the story in `STORY.md`.
- `practice/` is separate. Nothing here is copied from it.

## Local Contracts

- Stack: TanStack Start (Vite) + TanStack Router file routes, React 19, Nitro, zod, react-markdown, OpenUI (`@openuidev/react-lang`, pinned). Bun is the package manager; run from the repo root (`bun install`) or this folder. Every dependency must be OSI-approved.
- Runtime: the application model does not depend on the runtime. Only `nitro({ preset })` in `vite.config.ts` selects it: `bun` by default, `NITRO_PRESET=node-server` for Node.
- Offline: no CDN fonts, scripts, images or API calls. The page must render with the network unplugged.
- Layout: `src/routes/` (thin, file-based) → `src/features/<name>/` (`index.ts` is the public surface) → `src/shared/` (never imports features). Feature code may import `shared/`; routes compose features.
- Server boundary: `*.server.ts` is server-only and starts with `import "@tanstack/react-start/server-only"`. It is imported only by the matching `*.functions.ts` (`createServerFn`). Routes and components call the `*.functions.ts` exports. Do not read `process.env` or the file system outside these files.
- Search params are validated with zod and are lenient: a bad value falls back (`.optional().catch(undefined)`) and never shows an error page. `?lang=en|vi` lives on the root route; `?stage=` on `/demo`. Language comes from `?lang=`, then `Accept-Language` (server function `getRequestLocale`).
- SSR mode per route, with the reason in the route file: `/` and `/story` `ssr: true` (content); `/demo` `ssr: 'data-only'` (loader on the server, interactive client component). `/` defers the gauge snapshot with `Await` (streaming); `/demo` fast-forward streams one `Snapshot` per day from an async-generator server function.
- Content: all UI text is in `src/shared/i18n/{en,vi}.ts` against one `Copy` type, so the two languages cannot drift. The story text stays Vietnamese (it is `STORY.md`).
- PRD thresholds: the PRD's hazard tables carry numeric limits (e.g. pulse wave velocity, troponin, ONSD) with no source URL, so the page does not show them. Only limits that trace to NASA-STD-3001 Vol. 1 Rev B are shown, each linked to its `[V1 xxxx]` requirement. The PRD also calls Sky a model trained and fine-tuned on NASA data; the page does not claim that, because the implementation is deterministic detection plus a local model with retrieval over NASA documents (root `AGENTS.md`).
- Claims: every outbound claim links to an entry in `src/shared/sources.ts`, with `checked` only when a person opened the URL. Demo numbers are illustrative and labelled "Simulated data". Do not add medical thresholds or weights here. Keep the disclaimer "AI-generated, not a substitute for a physician".
- No personal data, no photos or images of minors.
- Demo rule: nothing is queued or sent before Confirm (`canConfirm` / `canFastForward` / `linkStateFor` in `features/readiness-demo/model/readiness.ts`).
- Sky guide (`features/sky-guide`): `SkyGuideProvider` in the root layout hosts the flying Sky; routes place `<SkyStation id>` (ids in `shared/sky.ts`). Sky flies to the station nearest the reading line; clicking Sky starts a guided tour. On arrival the station renders its built-in OpenUI Lang preset (`copy.sky.stations[id].preset`) at once, then streams a panel from local Ollama (`OLLAMA_BASE_URL`, default `http://127.0.0.1:11434`; `OLLAMA_MODEL`, default `qwen3.5:9b`) through `api/compose.functions.ts`. With Ollama down the preset stays.
- Sky panel safety: the OpenUI catalog (`catalog/library.tsx`) has no actions. Numbers reach a panel only through `Fact(id)`; values come from `copy.sky.facts`, sources from `FACT_META`, and `STATION_FACTS` limits facts per station. `reviewProgram` rejects a model panel that does not parse cleanly, writes a digit in free text, or uses a fact the station does not allow, and the preset is shown instead. Presets pass the same review (tested). NASA-STD-3001 facts must equal the `data.rows` value with the same requirement (tested).
- Sky artwork: `SKY_IMAGE` in `features/sky-guide/components/SkyCompanion.tsx`, currently the placeholder `public/sky/angel.svg`. The final art is a static image with a transparent background, square, of an adult or abstract figure (no child-like cherub, root rule 5). It is AI-generated (Cursor), so list it in the AI disclosure and record its tool and terms before submission.
- OpenUI telemetry: runtime telemetry is opt-in and off; install telemetry is a postinstall script that bun does not run. Install with `DO_NOT_TRACK=1` and do not add `@openuidev/*` to `trustedDependencies`.

## Work Guidance

- Add a page: create `src/routes/<name>.tsx`, put the UI in a feature, add copy to both locales, add a nav link in `shared/layout/Header.tsx`, state the SSR mode and why, and place at least one `<SkyStation>`.
- Add a Sky station: add the id to `STATION_IDS` and `STATION_FACTS` in `shared/sky.ts`, add `name`, `brief` and a digit-free `preset` to both locales, place `<SkyStation id>` in the route. A new fact needs `FACT_IDS`, `FACT_META` (with a source) and a value in both locales.
- Keep pure logic (`model/`) free of React and IO so `vitest` can cover it. `vitest.config.ts` is separate from `vite.config.ts` on purpose (no Start/Nitro plugins in tests).
- `src/routeTree.gen.ts` is generated and gitignored.

## Verification

From the repo root: `bun run typecheck`, `bun run test`, `bun run build` (Turborepo runs this package). Production: `PORT=3100 bun run .output/server/index.mjs` from `apps/web` after a build. Check by hand: `/?lang=vi`, `/story`, `/demo` (Confirm, then Fast-forward), Sky landing on each station and the click-to-tour, network unplugged. To check the model path without Ollama, point `OLLAMA_BASE_URL` at a local mock that streams `/api/chat` NDJSON.

## Child DOX Index

None.
