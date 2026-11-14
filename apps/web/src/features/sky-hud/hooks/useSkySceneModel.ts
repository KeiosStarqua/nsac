import { useCallback, useMemo, useState } from "react";
import { FIXTURE_MODEL, greetingFor } from "../domain";
import type { PerformanceTier, SkySceneModel } from "../domain";
import { useAccessibleMotion } from "./useAccessibleMotion";
import { useMissionClock } from "./useMissionClock";
import { usePerformanceTier } from "./usePerformanceTier";
import { useVoiceSession } from "./useVoiceSession";

export function useSkySceneModel() {
  const { reducedMotion } = useAccessibleMotion();
  const { tier, setTier } = usePerformanceTier();
  const { phase, transcript, responseText, voiceEnergy, toggleVoice, submitTyped, retry, ttsEnabled, setTts } =
    useVoiceSession();
  const clock = useMissionClock(FIXTURE_MODEL.mission.missionDay, FIXTURE_MODEL.mission.spacecraftTimeIso);

  const [overrides, setOverrides] = useState<Partial<SkySceneModel>>({});

  const greeting = useMemo(
    () => greetingFor("en", new Date().getHours(), FIXTURE_MODEL.astronautDisplayName),
    [],
  );

  const model: SkySceneModel = useMemo(
    () => ({
      astronautDisplayName: FIXTURE_MODEL.astronautDisplayName,
      mission: { ...FIXTURE_MODEL.mission, spacecraftTimeIso: FIXTURE_MODEL.mission.spacecraftTimeIso },
      vitals: { ...FIXTURE_MODEL.vitals },
      health: { ...FIXTURE_MODEL.health } as any,
      voicePhase: phase,
      currentTranscript: transcript ?? undefined,
      responseText: responseText ?? undefined,
      voiceEnergy,
      performanceTier: tier,
      reducedMotion,
      ...overrides,
    }),
    [phase, transcript, responseText, voiceEnergy, tier, reducedMotion, overrides],
  );

  const toggleVoiceWrapped = useCallback(() => toggleVoice(), [toggleVoice]);
  const submitTypedWrapped = useCallback((t: string) => submitTyped(t), [submitTyped]);
  const retryWrapped = useCallback(() => retry(), [retry]);
  const setPerformanceTier = useCallback((t: PerformanceTier) => setTier(t), [setTier]);

  return {
    model,
    greeting,
    clock,
    toggleVoice: toggleVoiceWrapped,
    submitTyped: submitTypedWrapped,
    retry: retryWrapped,
    setPerformanceTier,
    ttsEnabled,
    setTts,
    setOverrides,
  };
}