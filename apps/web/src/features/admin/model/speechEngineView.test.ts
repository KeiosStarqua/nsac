import { describe, expect, it } from "vitest";
import {
  canCreateEngine,
  canDeleteEngine,
  connectionState,
  showEnvShadowWarning,
  wsToggleAction,
  type SpeechEngineStatusData,
} from "./speechEngineView";

const base: SpeechEngineStatusData = {
  ok: true,
  configured: false,
  engineId: null,
  source: null,
  wsRunning: false,
  port: 3300,
  lastError: null,
  apiKeyConfigured: true,
  envOverridesDb: false,
};

const configured: SpeechEngineStatusData = {
  ...base,
  configured: true,
  engineId: "eng_test123",
  source: "db",
  wsRunning: true,
};

describe("speechEngineView", () => {
  it("connected only when the backend reports configured (id + running WS)", () => {
    expect(connectionState(configured)).toBe("connected");
    expect(connectionState({ ...configured, wsRunning: false, configured: false })).toBe("not_configured");
    expect(connectionState({ ...base, engineId: "eng_x", source: "env", wsRunning: false })).toBe("not_configured");
    expect(connectionState(base)).toBe("not_configured");
  });

  it("create requires a configured API key", () => {
    expect(canCreateEngine(base)).toBe(true);
    expect(canCreateEngine({ ...base, apiKeyConfigured: false })).toBe(false);
  });

  it("delete requires an effective engine id", () => {
    expect(canDeleteEngine(base)).toBe(false);
    expect(canDeleteEngine(configured)).toBe(true);
    expect(canDeleteEngine({ ...base, engineId: "eng_env", source: "env" })).toBe(true);
  });

  it("env-shadow warning reflects envOverridesDb", () => {
    expect(showEnvShadowWarning(base)).toBe(false);
    expect(showEnvShadowWarning({ ...configured, source: "env", envOverridesDb: true })).toBe(true);
  });

  it("ws toggle direction follows wsRunning", () => {
    expect(wsToggleAction(configured)).toBe("stop");
    expect(wsToggleAction({ ...configured, wsRunning: false })).toBe("start");
  });
});
