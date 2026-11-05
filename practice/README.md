# Ship Health: practice monorepo

Practice project. Fictional crew, toy numbers, not medical advice.

```
packages/sim       seeded SEIR flu model + story events (pure TypeScript)
packages/ui-lib    OpenUI component library the AI writes with (React)
packages/agent     Mastra agent + tools, local Ollama, deterministic fallback
apps/web           TanStack Start app (bun runtime via Nitro)
```

## Run

Requires bun (`~/.bun/bin`). Everything runs through bun.

```
bun install
bun run dev        # http://localhost:3000
bun run typecheck
bun run build
cd apps/web && PORT=3100 bun run .output/server/index.mjs
```

## Pages

| Route | SSR mode | What it shows |
|---|---|---|
| `/` | `true` | Dashboard. Numbers server-rendered, briefing streamed in behind Suspense |
| `/outbreak` | `'data-only'` | Animated cabin map, epidemic curve and story. Loader on the server, render in the browser |
| `/agent` | `false` | Ask the AI. Streams OpenUI Lang from `/api/agent` |
| `/crew/$memberId` | `true` | One crew member. Unknown id gives a 404 |

State lives in the URL: `?seed=7&day=8&iv=["4:masks"]`. Bad values fall back to safe defaults.

## Local AI (optional)

Without Ollama the app shows a built-in briefing and says so. With it:

```
ollama pull qwen3:8b
OLLAMA_MODEL=qwen3:8b bun run dev
```

The AI only proposes an action. Nothing changes until you press the confirm button.
