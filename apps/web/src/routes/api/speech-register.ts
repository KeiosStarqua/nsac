import { createFileRoute } from "@tanstack/react-router";
import { handleSpeechRegister } from "~/features/speech/api/speechProxy.server";

// Same-origin proxy for the ElevenLabs Speech Engine voice chat: binds the HUD astronaut pick
// to the next speech conversation (the backend consumes the freshest registration on `init`).
// Deliberately NOT admin-gated — the chat sends it per voice session — and the backend
// validates the astronaut against the crew roster.
export const Route = createFileRoute("/api/speech-register")({
  server: {
    handlers: {
      POST: ({ request }) => handleSpeechRegister(request),
    },
  },
});
