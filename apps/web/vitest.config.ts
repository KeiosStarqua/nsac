import { defineConfig } from "vitest/config";

// Separate from vite.config.ts on purpose: unit tests cover pure modules and must not load the
// TanStack Start and Nitro build plugins.
export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: { environment: "node", include: ["src/**/*.test.ts"] },
});
