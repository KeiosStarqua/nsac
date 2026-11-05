import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { nitro } from "nitro/vite";
import { defineConfig } from "vite";

// Deployment target: Bun. Same app model everywhere; only the Nitro preset changes per runtime.
export default defineConfig({
  server: { port: 3000 },
  plugins: [
    tanstackStart(),
    nitro({
      preset: "bun",
      // Bun 1.3.12 fails to parse React's server renderer once it is re-bundled (labeled `else a: if`).
      // Tracing keeps react/react-dom as real packages, so Bun loads its own `server.bun.js` build.
      traceDeps: ["react", "react-dom"],
    }),
    viteReact(),
  ],
});
