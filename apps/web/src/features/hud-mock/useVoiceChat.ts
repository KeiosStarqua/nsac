// ElevenLabs Speech Engine voice chat for the `/` console, built on `@elevenlabs/client`.
//
// Lifecycle: tap the mic → if an astronaut is picked, POST `/api/speech-register` (web proxy → backend `/api/speech/register`; the backend
// binds the next `init { conversation_id }` to that pick), then POST `/api/speech-token` for a
// conversation token minted server-side (the engine runs with `auth.enable_auth: true`, so a bare
// agent id is not enough and the browser never holds the API key), then
// `Conversation.startSession({ conversationToken })`. ElevenLabs connects BACK to the backend's
// speech websocket; the browser only ever sees ElevenLabs. Tap again → `endSession`.
//
// The SDK owns the mic capture and the speaker output, and exposes the live frequency data:
// `getInputByteFrequencyData()` feeds the ListeningBar — no second MediaStream is opened. The
// output path plays TTS through the SDK's WebRTC/WS audio out; `/api/tts` is not involved.
//
// The `?arch=openui` declarative HUD never reaches this hook: it keeps its own `useSkyVoice`
// path untouched.
import { useCallback, useEffect, useRef, useState } from "react";
import type { VoiceConversation } from "@elevenlabs/client";
import type { VoicePhase } from "../sky-hud/types";

export type VoiceChatStatus = "idle" | "connecting" | "live";
export type VoiceChatMode = "listening" | "speaking";
/** Quiet failure states; the component maps them onto localized hint copy. */
export type VoiceChatNotice = "notConfigured" | "failed";

async function postRegister(astronautId: string): Promise<boolean> {
  try {
    const res = await fetch("/api/speech-register", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ astronautId }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/** Mints a conversation token, `"no_engine"` when voice is not configured, or null on failure. */
async function fetchConversationToken(): Promise<string | "no_engine" | null> {
  try {
    const res = await fetch("/api/speech-token", { method: "POST" });
    if (res.status === 404) {
      const data = (await res.json().catch(() => null)) as { error?: unknown } | null;
      return data?.error === "no_engine" ? "no_engine" : null;
    }
    if (!res.ok) return null;
    const data = (await res.json()) as { token?: unknown };
    return typeof data.token === "string" && data.token.length > 0 ? data.token : null;
  } catch {
    return null;
  }
}

export function useVoiceChat(astronautId: string | null) {
  const sessionRef = useRef<VoiceConversation | null>(null);
  // Incremented on every stop/astronaut change; in-flight starts bail when it moves.
  const generationRef = useRef(0);
  const [status, setStatus] = useState<VoiceChatStatus>("idle");
  const [mode, setMode] = useState<VoiceChatMode>("listening");
  const [notice, setNotice] = useState<VoiceChatNotice | null>(null);
  const energyRef = useRef(0);

  const stop = useCallback(async () => {
    generationRef.current += 1;
    const session = sessionRef.current;
    sessionRef.current = null;
    setStatus("idle");
    setMode("listening");
    setNotice(null);
    energyRef.current = 0;
    if (session) {
      try {
        await session.endSession();
      } catch {
        // The SDK reports teardown over callbacks; a failed endSession leaves the
        // upstream socket to close on its own — nothing for the console to do.
      }
    }
  }, []);

  const start = useCallback(async () => {
    if (!astronautId || status !== "idle") return;
    const generation = ++generationRef.current;
    setNotice(null);
    setStatus("connecting");
    setMode("listening");

    const registered = await postRegister(astronautId);
    if (generation !== generationRef.current) return;
    if (!registered) {
      setNotice("failed");
      setStatus("idle");
      return;
    }
    const conversationToken = await fetchConversationToken();
    if (generation !== generationRef.current) return;
    if (conversationToken === "no_engine") {
      setNotice("notConfigured");
      setStatus("idle");
      return;
    }
    if (!conversationToken) {
      setNotice("failed");
      setStatus("idle");
      return;
    }
    try {
      // Dynamic import: the SDK (and its livekit-client dependency) stays out of the entry chunk.
      const { Conversation } = await import("@elevenlabs/client");
      const started = await Conversation.startSession({
        conversationToken,
        onModeChange: ({ mode: next }) => setMode(next),
        onDisconnect: () => {
          // Engine closed the socket (or the user ended elsewhere) — reset without re-entering endSession.
          generationRef.current += 1;
          sessionRef.current = null;
          setStatus("idle");
          setMode("listening");
        },
        onError: (message) => {
          // Never log key material — the SDK error strings do not carry any.
          console.error(`[voice] engine error: ${String(message).slice(0, 200)}`);
          void stop();
          setNotice("failed");
        },
      });
      if (generation !== generationRef.current) {
        // The pick changed while we were connecting — end the session we just created.
        await started.endSession().catch(() => undefined);
        return;
      }
      if (started.type !== "voice") {
        // We asked for a voice session but the SDK produced a text one — fail quietly.
        await started.endSession().catch(() => undefined);
        setNotice("failed");
        setStatus("idle");
        return;
      }
      const session: VoiceConversation = started;
      sessionRef.current = session;
      setStatus("live");
    } catch (err) {
      // Mic denied, token rejected, CSP, offline — all land here as a quiet failure.
      console.error(`[voice] start failed: ${String((err as Error)?.message ?? err).slice(0, 200)}`);
      if (generation !== generationRef.current) return;
      setNotice("failed");
      setStatus("idle");
    }
  }, [astronautId, status, stop]);

  // The HUD pick changed (or was kicked back to the picker by a claims epoch loss) mid-session:
  // end the conversation gracefully so it never keeps talking for the old astronaut.
  const astronautRef = useRef(astronautId);
  useEffect(() => {
    if (astronautRef.current !== astronautId) {
      astronautRef.current = astronautId;
      if (sessionRef.current || status !== "idle") void stop();
    }
  }, [astronautId, status, stop]);

  // Unmount: end the session; never leak an open mic.
  useEffect(
    () => () => {
      const session = sessionRef.current;
      sessionRef.current = null;
      if (session) void session.endSession().catch(() => undefined);
    },
    [],
  );

  /**
   * `ListeningBar`-compatible spectrum reader: copies the SDK's mic bins (already resampled to
   * the 100–8000 Hz voice range by the SDK) into `bars`. Returns false when no session is live.
   */
  const readSpectrum = useCallback((bars: Uint8Array): boolean => {
    const session = sessionRef.current;
    if (!session) return false;
    try {
      const src = session.getInputByteFrequencyData();
      const n = bars.length;
      if (n === 0 || src.length === 0) return true;
      for (let i = 0; i < n; i++) {
        bars[i] = src[Math.floor((i * src.length) / n)] ?? 0;
      }
      return true;
    } catch {
      return false;
    }
  }, []);

  /** VoicePhase mapping for the passive waveform mirror (`VoiceWaveform` derives motion from it). */
  const wavePhase: VoicePhase =
    status === "live" ? (mode === "speaking" ? "speaking" : "listening") : status === "connecting" ? "transcribing" : "idle";

  /**
   * Per-frame energy for `VoiceWaveform`: the SDK's own input/output volume (0–1 mean of the
   * voice-range bins). Falls back to a fast decay when no session is live.
   */
  const syncEnergy = useCallback(() => {
    const session = sessionRef.current;
    if (!session) {
      energyRef.current *= 0.92;
      return;
    }
    let v = 0;
    try {
      v = Math.max(session.getInputVolume(), session.getOutputVolume());
    } catch {
      v = 0;
    }
    const target = Math.min(1, v * 5);
    energyRef.current += (target - energyRef.current) * 0.3;
  }, []);

  return { status, mode, notice, energyRef, wavePhase, readSpectrum, syncEnergy, start, stop, setNotice };
}
