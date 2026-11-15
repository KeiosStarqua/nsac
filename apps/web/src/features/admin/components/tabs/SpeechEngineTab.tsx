import { SpeechEnginePanel } from "../SpeechEnginePanel";
import { useAdminGate } from "../admin-gate";

// Speech Engine panel (manage the ElevenLabs speech engine behind the / mic voice chat).
// Unauthorized/session-expired responses from the admin server functions bounce the page to locked.
export function SpeechEngineTab() {
  const { lock } = useAdminGate();
  return <SpeechEnginePanel onSessionExpired={lock} />;
}
