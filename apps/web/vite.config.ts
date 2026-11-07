import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { nitro } from "nitro/vite";
import { defineConfig } from "vite";

// The application model (routes, loaders, server functions) is runtime-agnostic. Only the Nitro preset
// picks the target runtime: `bun` by default (the demo laptop), `NITRO_PRESET=node-server` for Node.
// https://tanstack.com/start/latest/docs/framework/react/guide/hosting
export default defineConfig({
  server: { port: 3000 },
  resolve: { tsconfigPaths: true },
  plugins: [
    tanstackStart(),
    nitro({ preset: process.env.NITRO_PRESET ?? "bun" }),
    // React's Vite plugin must come after Start's.
    viteReact(),
  ],
});
