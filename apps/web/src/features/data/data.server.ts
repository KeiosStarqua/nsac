import "@tanstack/react-start/server-only";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Reads DATA.html straight from the `data` submodule — no copy in this
// package. Candidates cover the layouts the server runs in: cwd = repo root
// (scratch runs), cwd = apps/web (dev + the production runbook), the source
// file's own location (vite dev), and the built bundle location
// (.output/server/_ssr/*.mjs, one level deeper than .output/server).
const moduleDir = path.dirname(fileURLToPath(import.meta.url));
const candidates = [
  path.resolve(process.cwd(), "data/DATA.html"),
  path.resolve(process.cwd(), "../../data/DATA.html"),
  path.resolve(moduleDir, "../../../../data/DATA.html"),
  path.resolve(moduleDir, "../../../../../data/DATA.html"),
];

export function readDataHtml(): string | null {
  for (const candidate of candidates) {
    try {
      return readFileSync(candidate, "utf8");
    } catch {
      // try the next layout
    }
  }
  return null;
}
