import { createFileRoute, redirect } from "@tanstack/react-router";

// Legacy deep link — the ElevenLabs key panel folded into "API Keys".
export const Route = createFileRoute("/admin/elevenlabs")({
  beforeLoad: () => {
    throw redirect({ to: "/admin/keys" });
  },
});
