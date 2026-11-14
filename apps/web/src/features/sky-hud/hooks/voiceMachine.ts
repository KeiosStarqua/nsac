import type { VoicePhase } from "../domain";

export type VoiceAction =
  | { type: "REQUEST_PERMISSION" }
  | { type: "GRANTED" }
  | { type: "DENIED"; message?: string }
  | { type: "ENDPOINT" }
  | { type: "USER_STOP" }
  | { type: "TRANSCRIPT_READY" }
  | { type: "FAILURE"; message?: string }
  | { type: "ANSWER_READY"; hasTts: boolean }
  | { type: "TTS_ENDED" }
  | { type: "INTERRUPT" }
  | { type: "OFFLINE" }
  | { type: "RETRY" }
  | { type: "SET_TTS"; enabled: boolean };

export interface VoiceState {
  phase: VoicePhase;
  ttsEnabled: boolean;
  errorMessage: string | null;
  transcript: string | null;
  responseText: string | null;
}

export const initialVoiceState: VoiceState = {
  phase: "idle",
  ttsEnabled: true,
  errorMessage: null,
  transcript: null,
  responseText: null,
};

export function voiceReducer(state: VoiceState, action: VoiceAction): VoiceState {
  switch (action.type) {
    case "REQUEST_PERMISSION":
      return { ...state, phase: "requesting_permission", errorMessage: null };
    case "GRANTED":
      if (state.phase !== "requesting_permission") return state;
      return { ...state, phase: "listening" };
    case "DENIED":
      if (state.phase !== "requesting_permission") return state;
      return { ...state, phase: "error", errorMessage: action.message ?? "Microphone unavailable." };
    case "ENDPOINT":
      if (state.phase !== "listening") return state;
      return { ...state, phase: "transcribing" };
    case "USER_STOP":
      if (state.phase !== "listening") return state;
      return { ...state, phase: "idle" };
    case "TRANSCRIPT_READY":
      if (state.phase !== "transcribing") return state;
      return { ...state, phase: "thinking" };
    case "FAILURE":
      if (state.phase !== "transcribing") return state;
      return { ...state, phase: "error", errorMessage: action.message ?? "Could not understand." };
    case "ANSWER_READY":
      if (state.phase !== "thinking") return state;
      if (action.hasTts && state.ttsEnabled) return { ...state, phase: "speaking" };
      return { ...state, phase: "idle" };
    case "TTS_ENDED":
      if (state.phase !== "speaking") return state;
      return { ...state, phase: "idle" };
    case "INTERRUPT":
      if (state.phase !== "speaking") return state;
      return { ...state, phase: "listening" };
    case "OFFLINE":
      return { ...state, phase: "offline" };
    case "RETRY":
      if (state.phase !== "error" && state.phase !== "offline") return state;
      return { ...state, phase: "idle", errorMessage: null };
    case "SET_TTS":
      return { ...state, ttsEnabled: action.enabled };
    default:
      return state;
  }
}

// selectors
export const selectPhase = (s: VoiceState): VoicePhase => s.phase;
export const selectTtsEnabled = (s: VoiceState): boolean => s.ttsEnabled;
export const selectErrorMessage = (s: VoiceState): string | null => s.errorMessage;
export const selectTranscript = (s: VoiceState): string | null => s.transcript;
export const selectResponseText = (s: VoiceState): string | null => s.responseText;