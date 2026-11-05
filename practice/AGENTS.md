# practice

## Purpose

Hands-on practice monorepo (Turborepo + bun): TanStack Start web app, a toy flu-outbreak simulation, a Mastra agent on local Ollama, and an OpenUI component library. It is NOT the HKT submission and shares no code with `backend/` or `apps/`.

## Ownership

- This folder owns everything under `practice/`. Root `AGENTS.md` owns the HKT rules that limit it.
- Nothing here may be moved or copied into `backend/`, `apps/`, `assets/` or `shared/` before 14/11/2026 09:00 (Asia/Saigon). Re-implement after that date instead.

## Local Contracts

- Package manager and runner: bun only (`packageManager: bun@1.3.12`). No npm, pnpm or Node scripts. Install and cache stay on D: (`bunfig.toml` sets the cache inside this folder; global rule: nothing on C:).
- Layout: `packages/sim` (pure seeded SEIR, no IO) <- `packages/ui-lib` (OpenUI library, React) <- `packages/agent` (Mastra, server only) <- `apps/web` (TanStack Start). Dependencies point inward; `apps/web` features may import `shared/`, never the reverse.
- Server-only boundary: `@practice/agent`, Mastra and Ollama are imported only from `apps/web/src/server/*.server.ts` and `src/routes/api/*`. Server functions live in `*.functions.ts`. The browser bundle must contain none of them.
- Search params (`seed`, `day`, `iv`) are validated in the `_ship` layout with the lenient schema (`.catch`). Trust boundaries (`/api/agent`, server functions) use the strict schema and reject bad input.
- The AI proposes, a click decides: only `useScenario().confirmIntervention` changes the story, and only from a `ConfirmAction` click. Detection (`proposeNext`) is deterministic; the LLM only explains.
- SSR modes: `/` and `/crew/$memberId` `ssr: true`, `/outbreak` `ssr: 'data-only'`, `/agent` `ssr: false`. Keep this split when adding routes and say why.
- Offline: no cloud model, no OpenUI Gateway key. Ollama via `/v1` (`OLLAMA_BASE_URL`, `OLLAMA_MODEL`, default `qwen3:8b`); when Ollama is down the built-in briefing is used.
- All crew, numbers and parameters are fictional toy values. Do not present them as medical data.
- `apps/web/vite.config.ts` traces `react` and `react-dom` (`traceDeps`) because bun 1.3.12 cannot parse React's re-bundled server renderer. Remove it only after verifying a build starts on a newer bun.

## Work Guidance

- Typed access to the scenario goes through `useScenario`; do not hand-build search objects in pages.
- New OpenUI components go in `packages/ui-lib/src/components.tsx`, are added to `healthLibrary`, and stay short so a small local model can follow the prompt.

## Verification

From `practice/` (with `~/.bun/bin` on PATH): `bun run typecheck`, `bun run build`. Run the production server with `PORT=3100 bun run apps/web/.output/server/index.mjs` from `apps/web`.

## Child DOX Index

None.
