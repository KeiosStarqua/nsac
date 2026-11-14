# REPORT — sky-hud/hooks slice

## Works
- voiceMachine.ts: full reducer + selectors, all spec §5 transitions covered.
- voiceMachine.test.ts: 12 cases, all pass.
- useVoiceSession, useSkySceneModel, useVitalStream, useMissionClock, usePerformanceTier, useAccessibleMotion, useCriticalAlertPresenter, strings.ts (en/vi), index.ts.
- Typecheck: hooks compile cleanly (pre-existing routeTree.gen/SkyScreen errors unrelated).
- Tests: 103 passed.

## Does not work / blockers
- useVoiceSession uses simulated flows (setTimeout); real mic permission only on toggle. No real analyser; energy simulated.
- useVitalStream now param; pure helper test not separate (folded into formatting.test.ts domain).

## Lead wires next
- Wire useSkySceneModel into components; provide real Web Audio analyser for amplitude.
- Connect offline detection to voice machine OFFLINE action on navigator.onLine changes.
- Add useVitalStream tests for freshness.