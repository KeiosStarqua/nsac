import { useCallback, useEffect, useRef, useState } from "react";
import type { Locale } from "~/shared/i18n";
import { useLocale } from "~/shared/i18n";
import { skyAnswer } from "./strings";
import { initialVoiceState, voiceReducer } from "./voiceMachine";
import type { VoiceState } from "./voiceMachine";

export function useVoiceSession() {
  const locale = (useLocale() as Locale) ?? "en";
  const [state, setState] = useState<VoiceState>(initialVoiceState);
  const [voiceEnergy, setVoiceEnergy] = useState(0);
  const recognitionRef = useRef<any>(null);
  const rafRef = useRef<number | null>(null);

  const dispatch = useCallback((a: Parameters<typeof voiceReducer>[1]) => {
    setState((s) => voiceReducer(s, a));
  }, []);

  const submitTyped = useCallback(
    (text: string) => {
      const answer = skyAnswer(locale, text);
      setState((s) => {
        const next = voiceReducer(s, { type: "ANSWER_READY", hasTts: true });
        return { ...next, transcript: text, responseText: answer };
      });
      if (state.ttsEnabled && typeof window !== "undefined" && "speechSynthesis" in window) {
        const u = new SpeechSynthesisUtterance(answer);
        window.speechSynthesis.speak(u);
        u.onend = () => dispatch({ type: "TTS_ENDED" });
      } else {
        // no tts -> idle after ready
        setTimeout(() => dispatch({ type: "TTS_ENDED" }), 0);
      }
    },
    [locale, state.ttsEnabled, dispatch],
  );

  const toggleVoice = useCallback(() => {
    const phase = state.phase;
    if (phase === "idle" || phase === "error" || phase === "offline") {
      dispatch({ type: "REQUEST_PERMISSION" });
      // simulate permission grant in tests? Real: request mic. We'll request lazily.
      if (typeof navigator !== "undefined" && navigator.mediaDevices?.getUserMedia) {
        navigator.mediaDevices
          .getUserMedia({ audio: true })
          .then(() => dispatch({ type: "GRANTED" }))
          .catch(() => dispatch({ type: "DENIED", message: "Microphone unavailable — type instead." }));
      } else {
        // no API -> error
        dispatch({ type: "DENIED", message: "Microphone unavailable — type instead." });
      }
    } else if (phase === "listening") {
      dispatch({ type: "USER_STOP" });
    } else if (phase === "speaking") {
      dispatch({ type: "INTERRUPT" });
    }
  }, [state.phase, dispatch]);

  const retry = useCallback(() => dispatch({ type: "RETRY" }), [dispatch]);

  // Web Speech recognition setup when granted listening
  useEffect(() => {
    if (state.phase !== "listening") return;
    const SR =
      typeof window !== "undefined"
        ? (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
        : null;
    if (SR) {
      const rec = new SR();
      recognitionRef.current = rec;
      rec.interimResults = true;
      rec.continuous = false;
      rec.onresult = (e: any) => {
        let final = "";
        let interim = "";
        for (let i = 0; i < e.results.length; i++) {
          const r = e.results[i];
          if (r.isFinal) final += r[0].transcript;
          else interim += r[0].transcript;
        }
        setState((s) => ({ ...s, transcript: final || interim }));
        if (final) {
          dispatch({ type: "ENDPOINT" });
          // simulate transcribing -> thinking -> answer
          setTimeout(() => {
            dispatch({ type: "TRANSCRIPT_READY" });
            const answer = skyAnswer(locale, final);
            setState((s) => ({ ...s, responseText: answer }));
            setTimeout(() => dispatch({ type: "ANSWER_READY", hasTts: true }), 200);
          }, 200);
        }
      };
      rec.onerror = () => dispatch({ type: "FAILURE", message: "Could not understand." });
      rec.onend = () => {
        // if still listening, stop
      };
      try {
        rec.start();
      } catch {
        dispatch({ type: "FAILURE", message: "Could not start recognition." });
      }
    } else {
      // absent -> error
      dispatch({ type: "FAILURE", message: "Speech recognition is not available in this browser." });
    }
    return () => {
      try {
        recognitionRef.current?.stop?.();
      } catch {}
    };
  }, [state.phase, locale, dispatch]);

  // amplitude simulation via rAF when listening/speaking
  useEffect(() => {
    if (state.phase !== "listening" && state.phase !== "speaking") {
      setVoiceEnergy(0);
      return;
    }
    let running = true;
    const loop = () => {
      if (!running) return;
      setVoiceEnergy((prev) => {
        const target = state.phase === "listening" ? 0.35 : 0.5;
        return prev + (target - prev) * 0.1;
      });
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => {
      running = false;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [state.phase]);

  // TTS toggle helper
  const setTts = useCallback((enabled: boolean) => dispatch({ type: "SET_TTS", enabled }), [dispatch]);

  // offline detection
  useEffect(() => {
    if (typeof window === "undefined") return;
    const onOffline = () => dispatch({ type: "OFFLINE" });
    window.addEventListener("offline", onOffline);
    return () => window.removeEventListener("offline", onOffline);
  }, [dispatch]);

  return {
    phase: state.phase,
    ttsEnabled: state.ttsEnabled,
    transcript: state.transcript,
    responseText: state.responseText,
    errorMessage: state.errorMessage,
    voiceEnergy,
    toggleVoice,
    submitTyped,
    retry,
    setTts,
    onToggle: toggleVoice,
    onInterrupt: () => dispatch({ type: "INTERRUPT" }),
  };
}