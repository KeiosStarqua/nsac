import { createFileRoute } from "@tanstack/react-router";
import { handleSpeechConfig } from "~/features/speech/api/speechProxy.server";

// Same-origin proxy for the ElevenLabs Speech Engine public config. Returns `{ engineId }`
// (a public instance handle) so the browser can start the conversation; a missing engine
// passes through as `404 { ok: false, error: "no_engine" }` so the console can show the quiet
// "Voice not configured" hint. The API key never leaves the backend.
export const Route = createFileRoute("/api/speech-config")({
  server: {
    handlers: {
      GET: ({ request }) => handleSpeechConfig(request),
    },
  },
});
