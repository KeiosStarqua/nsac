import { describe, it, expect } from "vitest";
import { initialVoiceState, voiceReducer } from "./voiceMachine";

describe("voiceMachine", () => {
  it("idle -> requesting_permission -> listening", () => {
    let s = voiceReducer(initialVoiceState, { type: "REQUEST_PERMISSION" });
    expect(s.phase).toBe("requesting_permission");
    s = voiceReducer(s, { type: "GRANTED" });
    expect(s.phase).toBe("listening");
  });
  it("requesting_permission denied -> error", () => {
    let s = voiceReducer(initialVoiceState, { type: "REQUEST_PERMISSION" });
    s = voiceReducer(s, { type: "DENIED" });
    expect(s.phase).toBe("error");
  });
  it("listening endpoint -> transcribing -> thinking", () => {
    let s = { ...initialVoiceState, phase: "listening" } as any;
    s = voiceReducer(s, { type: "ENDPOINT" });
    expect(s.phase).toBe("transcribing");
    s = voiceReducer(s, { type: "TRANSCRIPT_READY" });
    expect(s.phase).toBe("thinking");
  });
  it("listening user stop -> idle", () => {
    let s = { ...initialVoiceState, phase: "listening" } as any;
    s = voiceReducer(s, { type: "USER_STOP" });
    expect(s.phase).toBe("idle");
  });
  it("transcribing failure -> error", () => {
    let s = { ...initialVoiceState, phase: "transcribing" as any };
    s = voiceReducer(s, { type: "FAILURE" });
    expect(s.phase).toBe("error");
  });
  it("thinking answer ready tts enabled -> speaking", () => {
    let s = { ...initialVoiceState, phase: "thinking" as any, ttsEnabled: true };
    s = voiceReducer(s, { type: "ANSWER_READY", hasTts: true });
    expect(s.phase).toBe("speaking");
  });
  it("thinking answer ready no tts -> idle", () => {
    let s = { ...initialVoiceState, phase: "thinking" as any, ttsEnabled: false };
    s = voiceReducer(s, { type: "ANSWER_READY", hasTts: true });
    expect(s.phase).toBe("idle");
  });
  it("thinking answer ready hasTts false -> idle", () => {
    let s = { ...initialVoiceState, phase: "thinking" as any, ttsEnabled: true };
    s = voiceReducer(s, { type: "ANSWER_READY", hasTts: false });
    expect(s.phase).toBe("idle");
  });
  it("speaking ended -> idle", () => {
    let s = { ...initialVoiceState, phase: "speaking" as any };
    s = voiceReducer(s, { type: "TTS_ENDED" });
    expect(s.phase).toBe("idle");
  });
  it("speaking interrupt -> listening", () => {
    let s = { ...initialVoiceState, phase: "speaking" as any };
    s = voiceReducer(s, { type: "INTERRUPT" });
    expect(s.phase).toBe("listening");
  });
  it("offline from any phase", () => {
    for (const p of ["idle", "listening", "thinking", "speaking", "error"] as const) {
      const s = { ...initialVoiceState, phase: p };
      const r = voiceReducer(s, { type: "OFFLINE" });
      expect(r.phase).toBe("offline");
    }
  });
  it("error/offline retry -> idle", () => {
    let s = { ...initialVoiceState, phase: "error" as any };
    s = voiceReducer(s, { type: "RETRY" });
    expect(s.phase).toBe("idle");
    s = { ...initialVoiceState, phase: "offline" as any };
    s = voiceReducer(s, { type: "RETRY" });
    expect(s.phase).toBe("idle");
  });
});