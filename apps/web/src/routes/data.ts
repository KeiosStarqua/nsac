import { createFileRoute } from "@tanstack/react-router";
import { readDataHtml } from "~/features/data/data.server";

// Serves the data submodule's DATA.html as a complete HTML document at /data,
// read from disk per request. No app shell, no React, no three.js: the file
// is already a full document with its own inline CSS/JS. Exact match only.
export const Route = createFileRoute("/data")({
  server: {
    handlers: {
      GET: async () => {
        const html = readDataHtml();
        if (html === null) {
          return new Response("data/DATA.html not found (submodule not checked out?)", {
            status: 500,
            headers: { "content-type": "text/plain; charset=utf-8" },
          });
        }
        return new Response(html, {
          headers: { "content-type": "text/html; charset=utf-8" },
        });
      },
    },
  },
});
