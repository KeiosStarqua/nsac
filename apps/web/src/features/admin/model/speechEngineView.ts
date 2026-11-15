// Pure view-model for the /admin "Speech Engine" panel. Kept free of React and IO so vitest can
// cover the configured / not-configured states without a DOM (the app's vitest runs in `node`).

export interface SpeechEngineStatusData {
  ok: true;
  configured: boolean;
  engineId: string | null;
  source: "env" | "db" | null;
  wsRunning: boolean;
  port: number;
  lastError: string | null;
  apiKeyConfigured: boolean;
  envOverridesDb: boolean;
}

export type ConnectionState = "connected" | "not_configured";

/** `configured` from the backend = effective engine id exists AND the WS is running. */
export function connectionState(status: SpeechEngineStatusData): ConnectionState {
  return status.configured ? "connected" : "not_configured";
}

/** Create stays disabled while no API key is configured (backend would 503-equivalent it). */
export function canCreateEngine(status: SpeechEngineStatusData): boolean {
  return status.apiKeyConfigured;
}

/** Delete is only meaningful when an effective engine id exists. */
export function canDeleteEngine(status: SpeechEngineStatusData): boolean {
  return status.engineId !== null;
}

/** env shadows the stored DB value — worth a warning line, never a blocker. */
export function showEnvShadowWarning(status: SpeechEngineStatusData): boolean {
  return status.envOverridesDb;
}

/** Toggle button label direction, derived from the live WS state. */
export function wsToggleAction(status: SpeechEngineStatusData): "stop" | "start" {
  return status.wsRunning ? "stop" : "start";
}
