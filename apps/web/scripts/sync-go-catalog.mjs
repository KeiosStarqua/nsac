#!/usr/bin/env bun
/**
 * Regenerate `src/features/admin/model/goCatalog.ts` from the `opencode-go.json` that ships with the
 * pinned `@earendil-works/pi-ai` SDK (transitive dependency of `@earendil-works/pi-coding-agent`).
 *
 * Run from `apps/web` (or anywhere):
 *   bun apps/web/scripts/sync-go-catalog.mjs
 *
 * After bumping `@earendil-works/pi-coding-agent`, run this again and commit the diff — the snapshot
 * is deliberately static so /admin works offline and the SDK catalog never leaks surprises into the
 * picker. Source lookup order:
 *   1. `GO_CATALOG_SRC` env var (explicit path to opencode-go.json)
 *   2. sibling of the resolved `@earendil-works/pi-coding-agent` package (bun isolated store layout)
 *   3. the `@earendil-works+pi-ai@*` store directories under `node_modules/.bun/`
 *
 * Sky is an external client to OpenCode Go: the free ($0/MTok) tier is reserved for the official
 * OpenCode client (external clients get HTTP 403), so free models are excluded from the snapshot.
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "..", "..", "..");
const outPath = join(here, "..", "src", "features", "admin", "model", "goCatalog.ts");

function findSource() {
  if (process.env.GO_CATALOG_SRC && existsSync(process.env.GO_CATALOG_SRC)) {
    return process.env.GO_CATALOG_SRC;
  }
  const require = createRequire(join(repoRoot, "apps", "web", "package.json"));
  try {
    const pca = realpathSync(require.resolve("@earendil-works/pi-coding-agent/package.json"));
    const sibling = join(dirname(pca), "..", "pi-ai", "dist", "providers", "data", "opencode-go.json");
    if (existsSync(sibling)) return sibling;
  } catch {
    // fall through to the glob
  }
  const bunStore = join(repoRoot, "node_modules", ".bun");
  if (existsSync(bunStore)) {
    const candidates = readdirSync(bunStore)
      .filter((entry) => entry.startsWith("@earendil-works+pi-ai@"))
      .map((entry) => join(bunStore, entry, "node_modules", "@earendil-works", "pi-ai", "dist", "providers", "data", "opencode-go.json"))
      .filter((candidate) => existsSync(candidate))
      .sort();
    if (candidates.length > 0) return candidates[candidates.length - 1];
  }
  throw new Error(
    `opencode-go.json not found. Set GO_CATALOG_SRC to the file's absolute path.`,
  );
}

const source = findSource();
const raw = JSON.parse(readFileSync(source, "utf8"));

const models = [];
for (const family of Object.values(raw)) {
  for (const entry of Object.values(family)) {
    const cost = entry.cost ?? {};
    const input = Number(cost.input);
    const output = Number(cost.output);
    if (!Number.isFinite(input) || !Number.isFinite(output)) continue;
    // Free tier is OpenCode-client-only; external clients get 403.
    if (input === 0 && output === 0) continue;
    models.push({
      id: entry.id,
      name: typeof entry.name === "string" && entry.name.trim() ? entry.name.trim() : entry.id,
      inputCostPerMTok: input,
      outputCostPerMTok: output,
      contextWindow: Number(entry.contextWindow) || 0,
      maxTokens: Number(entry.maxTokens) || 0,
    });
  }
}
models.sort((a, b) => a.id.localeCompare(b.id));

const header = `/**
 * Snapshot tĩnh của catalog OpenCode Go (provider id \`opencode-go\`, built-in của
 * \`@earendil-works/pi-ai\`, các endpoint \`https://opencode.ai/inference/go/...\`).
 *
 * Sinh bởi \`bun apps/web/scripts/sync-go-catalog.mjs\` từ \`opencode-go.json\` của SDK đã pin
 * (xem script đó để biết cách chạy lại sau khi SDK đổi version). KHÔNG sửa tay.
 *
 * Free ($0/MTok) models bị loại có chủ ý: Go chỉ dành cho OpenCode client, client ngoài bị 403 —
 * Sky là client ngoài nên chỉ dùng paid models.
 *
 * Nguồn: ${source}
 * Models: ${models.length} (free models excluded).
 */
export type GoCatalogModel = {
  id: string;
  name: string;
  /** USD per MTok input. */
  inputCostPerMTok: number;
  /** USD per MTok output. */
  outputCostPerMTok: number;
  contextWindow: number;
  maxTokens: number;
};

export const GO_CATALOG: readonly GoCatalogModel[] = [
`;

const body = models
  .map(
    (m) =>
      `  { id: ${JSON.stringify(m.id)}, name: ${JSON.stringify(m.name)}, inputCostPerMTok: ${m.inputCostPerMTok}, outputCostPerMTok: ${m.outputCostPerMTok}, contextWindow: ${m.contextWindow}, maxTokens: ${m.maxTokens} },`,
  )
  .join("\n");

mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, `${header}${body}\n];\n`, "utf8");
console.log(`wrote ${outPath} (${models.length} models from ${source})`);
