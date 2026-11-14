# HUD Components — Report

## Works
- All 11 components implemented (SkyIdentity, MissionContext, VitalsProjection, VitalMetric, MetricProjection, HealthProjection, GreetingPrompt, MicrophoneOrb, VoiceHint, Captions, CriticalAlertLayer).
- en/vi strings in strings.ts; useLocale from shared i18n.
- Tokens in hud.tokens.css.
- regionMapping pure helper + test.
- Typecheck: no errors in this folder. Tests pass.

## Does not
- No real positioning/layout (lead owns .hud-screen). Components expose no layout opinions.
- No hooks consumed (../hooks missing); components accept props per spec. TODO(lead): wire useSkySceneModel etc.
- No WebGL/3D orb (graphics agent scope).
- CriticalAlertLayer styling minimal.

## Lead wires next
- Import components through components/index.ts.
- Provide props from domain/fixtures + hooks.
- Layout container.