import { createFileRoute } from "@tanstack/react-router";
import { handleSpeechToken } from "~/features/speech/api/speechProxy.server";

// Same-origin proxy that mints an ElevenLabs Speech Engine conversation token. The engine runs
// with `auth.enable_auth: true`, so the browser presents a token (not a bare agent id) and the
// API key stays in the loopback backend. A missing engine passes through as
// `404 { ok: false, error: "no_engine" }` so the console can show the quiet hint.
export const Route = createFileRoute("/api/speech-token")({
  server: {
    handlers: {
      POST: ({ request }) => handleSpeechToken(request),
    },
  },
});
