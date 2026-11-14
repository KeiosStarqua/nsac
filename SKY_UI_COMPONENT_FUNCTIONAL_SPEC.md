# SKY — Pixel-Matched UI Component & Functional Specification

Version: 1.0 · Design reference: user-supplied SKY concept image (1672 × 941 pixels)

## Purpose and fidelity contract

Rebuild the supplied SKY astronaut wellness interface as independent, functional UI components while keeping the screenshot's spatial hierarchy, shapes, proportions, glow, color, density, and minimal controls. The image is a **single flattened concept rendering**, not an export of separable layers. Accordingly:

- **Exact initial bitmap appearance** is achievable by displaying the screenshot itself, but that does **not** produce editable or truly functional UI components.
- A **functional, close visual recreation** requires separate artwork for the spaceship interior, astronaut silhouette, Earth/space viewport, planet glow, holographic human figure, and layered shader effects. Recreating those assets may require 3D modeling, compositing or image editing.
- Do not disguise a background screenshot with invisible hotspots as a complete implementation.
- Use the supplied image as a visual reference and validation baseline; reconstruct actual HUD/AI/health layers as separate, accessible components.

This specification distinguishes what is present in the image (visual requirements) from new functionality proposed for the working application (interaction requirements).

## 1. Reference composition and layout

Source frame: `1672 × 941` px. Desktop layout is full-bleed, cinematic, non-scrolling. All placement below is **estimated from visual inspection**; fine-tune with reference-image overlay/difference testing rather than claiming these coordinates are pixel-perfect.

| ID | Component | Approx. bounding region (x,y,w,h) in reference px | z-index layer |
|---|---|---|---|
| BG01 | Space / vessel window + astronaut + Earth backdrop | 0,0,1672,941 | 0 |
| BG02 | Frame highlights / vignette | 0,0,1672,941 | 1 |
| UI01 | SKY brand / ring logo | 52,20,290,62 | 10 |
| UI02 | Mission identifier / ISS Day 170 | 1395,23,245,59 | 10 |
| UI03 | Vitals glass field | 78,111,290,305 | 12 |
| UI03a | Heart metric row | 170,145,190,65 | 15 |
| UI03b | Respiration metric row | 141,210,217,68 | 15 |
| UI03c | SpO2 metric row | 128,275,210,72 | 15 |
| UI03d | Sleep metric row | 145,342,220,78 | 15 |
| FX01 | Central organic translucent lens / elliptical aura | 407,284,838,309 | 12 |
| UI04 | Main AI energy orb | 714,125,248,244 | 18 |
| UI05 | Greeting and question | 620,373,475,111 | 20 |
| UI06 | AI audio waveform | 708,501,269,47 | 20 |
| UI07 | Health bubble / scan | 1250,120,337,267 | 14 |
| UI07a | Body hologram | 1303,164,126,223 | 18 |
| UI07b | Overall / Stable / guidance | 1430,195,159,115 | 18 |
| FX02 | Organic interaction surface | 358,638,1034,174 | 15 |
| UI08 | Circular microphone control | 792,607,85,107 | 22 |
| UI09 | Just talk to me… helper text | 748,741,250,46 | 20 |

**Layout rule:** Preserve the original overall visual balance: left vital cluster ~18% width, center conversational focus ~50%, right health status ~23%, lower visual input surface ~62%. The astronaut and Earth are cinematic contextual art, **not** interactive health UI.

At other aspect ratios, do not merely scale the 16:9 desktop canvas down until labels become tiny. Have explicit large-desktop, medium, tablet, and mobile compositions. Under mobile constraints, keep the AI core + voice affordance and progressively collapse the peripheral vitals/health projections into accessible contextual views without adding a conventional sidebar.

## 2. Layering and rendering architecture

Recommended DOM/Canvas composition:

```
<SkyScreen>
  <SpaceSceneBackground />          // still/video/3D, non-interactive
  <ViewportFrameFX />              // subtle metallic framing, reflection
  <MissionHeader>
    <SkyIdentity />
    <MissionContext />
  </MissionHeader>
  <VitalsProjection>               // left transparent, curved housing
    <VitalMetric kind="heartRate" />
    <VitalMetric kind="respiration" />
    <VitalMetric kind="spo2" />
    <VitalMetric kind="sleep" />
  </VitalsProjection>
  <ConversationLens>               // elliptical chromatic aura
    <AICoreOrb />
    <GreetingPrompt />
    <LiveVoiceWaveform />
    <Captions />                    // hidden until needed
  </ConversationLens>
  <HealthProjection>               // right spherical housing
    <HumanHologram />
    <OverallHealthSummary />
  </HealthProjection>
  <OrganicInputSurface>
    <MicrophoneOrb />
    <VoiceHint />
  </OrganicInputSurface>
  <ContextProjectionLayer />       // vitals drilldown, body details, etc.
  <CriticalAlertLayer />          // safety-priority, legible, no effects reliance
  <AccessibilityLiveRegion />
</SkyScreen>
```

Rendering responsibilities:

1. **React/DOM/SVG:** Real text, numeric values, keyboard focus, semantic buttons, diagnostic descriptions, subtitles, notifications.
2. **WebGL (Three.js/React Three Fiber) or WebGPU where supported:** Main AI orb, translucent organic lens, depth-aware holograms, plasma ribbons, decorative moving particles.
3. **CSS:** Responsive scene composition, typography, safe-area positioning, basic glow, opacity, pointer-event routing.
4. **Web Audio API:** Local audio amplitude/spectrum analysis for waveform and motion (after explicit mic permission).
5. **State manager:** Voice, mission data, sensor data, warnings, motion/performance mode; do not read values directly inside render loops when event-driven state will do.

Keep a `prefers-reduced-motion` fallback and an entirely readable DOM-only fallback if WebGL cannot initialize.

## 3. Component contracts and exact behavior

### UI01 — `SkyIdentity`

**Visual:** Top-left thin circular gradient crescent (blue/cyan/lavender), light wordmark `S K Y`, smaller subdued line `Astronaut Wellness AI`. No rectangular navbar.

**Inputs:** `productName='SKY'`, `subtitle`, `connectionState` optional. **Behavior:** Press/keyboard Enter returns to the default SKY overview, if already on overview speak/announce current mode. Do not use this logo to open a traditional menu. **States:** normal, focus-visible, disconnected (small textual indicator only when necessary).

### UI02 — `MissionContext`

**Visual:** Top-right white minimalist station symbol, `ISS · Day 170`, fine cyan curved line extending underneath. Header should be visually quiet.

**Inputs:** `missionName`, `missionDay`, `missionTimeUTC`, optional `latency`, `isOnline`. **Behavior:** Press reveals a compact projected mission-context view (calendar day, spacecraft time and connectivity) and pressing Escape closes it. Mission name/day shown are sample fixture data from reference, not inferred current reality.

### UI03 — `VitalsProjection` and four `VitalMetric` instances

**Visual:** A large nearly invisible left circular/elliptical translucent shield arc; four vertically stacked icons with light ring strokes, white values, cyan/lavender accents. No square metric cards, no axis charts on the idle screen.

| Order | Metric ID | Visible icon | Initial reference text | Units and formatting | Semantic tap result |
|---|---|---|---|---|---|
| 1 | `heartRate` | heart outline + cyan ring | `62 bpm` | integer bpm | projected heart rate history |
| 2 | `respiration` | thin lung outline + arc | `16 br/min` | breaths/min | breathing trends and sensor quality |
| 3 | `spo2` | `O₂` within ring | `98 %` | integer percentage | oxygen saturation trend |
| 4 | `sleep` | crescent moon + lilac ring | `7 h 42 m` | hours + minutes | sleep/recovery detail |

**Inputs:** `reading` (value, unit, timestamp, sensor quality, trend), `metricKind`, `baseline` optional, `thresholdRuleId`. **Events:** `onSelectMetric(kind)`.

**Functions:**
- `formatVital(kind, value)` — deterministic visual formatting, no fabricated value.
- `getReadingFreshness(reading, now, freshnessPolicy)` — current/stale/missing.
- `getReadingVisualState(reading, validatedRules)` — normal/advisory/warning/critical/unknown, with explicit missing-data handling.
- `openMetricProjection(kind)` — contextual, curved overlay that expands near the metric; close on Escape, click-away or explicit close control.

**Rules:** Never show an old reading as live. Unknown or stale readings must not silently retain cyan normal styling. Don't let an LLM decide medical thresholds. The reference numbers are illustrative mock values.

### UI04 — `AICoreOrb` (visual centerpiece)

**Visual:** Center at approximately `(838,247)`; ~230 px diameter. Highly luminous, transparent and multilayered: blue rim, cyan/azure internal flowing filaments, lavender/pink edge and a warmer amber highlight at lower-right. It must feel like a dynamic 3D object, **not** a simple CSS gradient circle.

**Renderer:** UV sphere or raymarched sphere with custom noise field, fresnel rim, rotated translucent interference bands, depth transparency and controlled selective bloom. Use low-frequency simplex/FBM displacement and animated parametric ribbon paths. Keep overdraw and GPU cost bounded.

**Props:** `phase`, `audioEnergy`, `speechEnergy`, `attentionTarget`, `reducedMotion`, `qualityTier`.

**State mapping:**

| Phase | Appearance | Motion |
|---|---|---|
| `idle` | default cyan/blue/lavender | slow breathing, very soft rotation |
| `listening` | brighter cyan core | oscillations follow input amplitude |
| `transcribing` | thin concentric traces | subtle inward convergence |
| `thinking` | blue ↔ violet swirl | measured faster interior movement |
| `speaking` | bright filaments | follows output audio energy |
| `offline` | lower saturation + textual offline state | minimal motion |
| `error` | restrained warm edge + accessible message | no aggressive flashing |
| `critical` | stable high-contrast alert mode | reduce decorative motion |

**Behavior:** Main orb can be focusable and activate the same `toggleVoice()` action as microphone, but only if visually labelled for accessibility and consistent with mic control. It should not create a different voice session. The main orb remains the central visual attention anchor throughout the conversation.

### FX01 — `ConversationLens`

**Visual:** A very wide, translucent blue–violet elliptical plasma lens surrounding the greeting, spanning the middle of the screen. Thin curved rim mostly at the edges, faint cyan/indigo internal motion, transparent interior. Crucial: **not** a bordered oval card.

**Functions:** `setLensIntensity(phase, urgency)`, `setLensCenterFromViewport()`, `animateLensField(time, speechEnvelope)`. Blur/glow must never interfere with text legibility. Lens should slightly respond to voice, but stay understated while idle.

### UI05 — `GreetingPrompt`

**Reference text:** `Good morning, Minh.` and `How are you feeling today?` Centered under the orb. White primary line, muted light gray-blue subtitle. The screenshot's name is illustrative, not a required user identity.

**Inputs:** `displayName`, `timeOfDay`, `prompt`, `locale`, `conversationPhase`. **Functions:** `getGreeting(locale, localShipTime, displayName)` (must use explicit mission-time context), `getPromptForContext(context)`. On user speech, may transition to an answer or action summary without introducing a permanent chat sidebar. Preserve text rendering as DOM so it can be selected, translated and read by screen readers.

### UI06 — `LiveVoiceWaveform`

**Visual:** Short, thin, glowing cyan horizontal waveform below greeting, centered around reference `y ≈ 518`; at rest mostly flat with one organic central pulse; no large equalizer bars.

**Inputs:** `audioSamples | analyserData`, `phase`, `amplitude`, `reducedMotion`. **Behavior:** `idle` synthetic slow pulse; `listening` follows microphone input FFT/RMS; `thinking` restrained symmetric pulses; `speaking` output track; `error` stops and displays readable text. The screen must clearly distinguish **real mic recording** from an idle decorative waveform.

**Functions:** `calculateRms(samples)`, `smoothEnvelope(previous, current, attack, release)`, `renderWaveformPath(envelope, t, width, height)`.

### UI07 — `HealthProjection`

**Visual:** Right translucent circular/spherical panel; pale cyan outline and internal glow. Half-body full-length holographic standing human on the left; status typography on the right. Do not replace with a typical rounded-rectangle health card.

**Inputs:** `healthSummary` (validated status, timestamp, source), `bodyRegionStates`, `context`. **Behavior:** Selecting hologram or status projects details into a curved, anchored view. When status is unavailable, show `Assessment unavailable` rather than inventing `Stable`.

### UI07a — `HumanHologram`

**Visual:** Tall cyan human figure with glowing blue outline, transparent interior, subtle chest illumination and warmer focal spot around torso as seen in reference. Can use an appropriately licensed rigged GLB mesh or layered transparent SVG for reduced quality. No anatomical claims should be inferred solely from the glow.

**Functions:** `highlightRegion(regionId, severity)`, `mapAssessmentToRegions(verifiedData)`, `showRegionDetails(regionId)`, `resetBodyPose()`. Support selectable regions via keyboard-accessible parallel DOM list. Hover detail labels can appear, but must be legible and not require precision gestures.

### UI07b — `OverallHealthSummary`

**Reference copy:** small `Overall`, large green `Stable`, smaller two lines `Maintain recovery` / `and readiness`.

**Inputs:** `assessment` from validated medical decision rules, `assessmentConfidence`, `timestamp`. **States:** Stable, Attention, Critical, Unknown (exact naming should follow medical governance). Always pair color with text/icon. **Events:** `onOpenHealthSummary()`.

**Safety:** Keep `Stable` strictly a fixture in the reference, not a calculated diagnosis based only on four dashboard readings. Any live medical assessment must come from approved clinician-defined logic or trusted medical systems.

### FX02 — `OrganicInputSurface`

**Visual:** Massive translucent curved sheet occupying lower-center area, shimmering cyan / blue / lavender, shaped like a horizontal fluid glass membrane with soft waves. It sits above the physical desk, appears projected, and has a broad glow/reflection. It is not a button or flat card.

**Implementation:** GPU plane with translucent projected SDF/Bezier spline contours, noise-driven deformation, additive but tightly controlled glow. **States:** serene idle, responsive listening, narrower thinking, broad speaking, alert-dimmed. **Function:** `updateSurfaceField(phase, energy, elapsed, qualityTier)`.

**Interaction:** The whole decorative surface should not accidentally catch taps meant for other controls; set `pointer-events: none` except actual interactive children.

### UI08 — `MicrophoneOrb`

**Visual:** Compact luminous circular microphone control centered above fluid sheet, at approximately `(835,661)` with ~82px outer diameter; fine bright cyan ring and simple white line microphone icon. This is the **primary, explicitly identifiable action**.

**Behavior:**
- First press: request microphone permission through the platform and begin user-controlled listening only on grant.
- While listening: press again to stop/cancel capture; present live caption state.
- While processing: prevent duplicate requests; allow cancellation.
- While speaking: pressing interrupts output and starts user voice input only when the user expressly intends it.
- Permission denied / no device: display a graceful visible error and offer typed input.
- No microphone capture or raw audio transmission on initial page load.
- Support Space / Enter, focus ring, ARIA accessible name, touch minimum 44px.

**Callbacks:** `onStartListening`, `onStopListening`, `onInterruptSpeaking`, `onRequestTextInput`. Show a truthful live capture indicator.

### UI09 — `VoiceHint`

**Reference copy:** `Just talk to me...` centered below microphone, small white. **Function:** phase-specific instructions: `Just talk to me…` (idle), `Listening… Tap to stop` (listening), `Understanding…` (thinking), `SKY is speaking` (speaking), `Microphone unavailable — type instead` (failure). Never say “Listening” before permission is granted and capture started.

## 4. TypeScript API contracts

```ts
export type VoicePhase =
  | 'idle'
  | 'requesting_permission'
  | 'listening'
  | 'transcribing'
  | 'thinking'
  | 'speaking'
  | 'offline'
  | 'error';

export type VitalKind = 'heartRate' | 'respiration' | 'spo2' | 'sleep';
export type VitalVisualState = 'normal' | 'advisory' | 'warning' | 'critical' | 'unknown';
export type HealthState = 'stable' | 'attention' | 'critical' | 'unknown';

export interface VitalReading {
  kind: VitalKind;
  value: number | null;          // sleep: total minutes
  unit: 'bpm' | 'br/min' | '%' | 'min';
  timestamp: string | null;      // ISO 8601
  source: string;
  quality: 'good' | 'poor' | 'unknown';
  visualState: VitalVisualState;
}

export interface MissionContextData {
  stationLabel: string;         // sample: ISS
  missionDay: number;           // sample: 170
  spacecraftTimeIso?: string;
  online: boolean;
}

export interface HealthAssessment {
  state: HealthState;
  summary: string;              // sample: Maintain recovery and readiness
  assessedAt: string | null;
  provenance: string | null;
  bodyRegions?: Array<{ id: string; state: VitalVisualState }>;
}

export interface SkySceneModel {
  astronautDisplayName: string; // sample: Minh
  mission: MissionContextData;
  vitals: Record<VitalKind, VitalReading>;
  health: HealthAssessment;
  voicePhase: VoicePhase;
  currentTranscript?: string;
  responseText?: string;
  voiceEnergy: number;           // normalized 0..1
  performanceTier: 'high' | 'balanced' | 'low';
  reducedMotion: boolean;
}

export interface AICoreOrbProps {
  phase: VoicePhase;
  audioEnergy: number;
  qualityTier: SkySceneModel['performanceTier'];
  reducedMotion: boolean;
}

export interface VitalMetricProps {
  reading: VitalReading;
  onSelect: (kind: VitalKind) => void;
}

export interface MicrophoneOrbProps {
  phase: VoicePhase;
  isMicActive: boolean;
  onToggle: () => void;
  onInterrupt: () => void;
}
```

**Fixture state in screenshot** (do not silently treat as measured live telemetry):

```
stationLabel: 'ISS', missionDay: 170
astronautDisplayName: 'Minh'
heartRate: 62 bpm
respiration: 16 br/min
spo2: 98 %
sleep: 462 min // display 7 h 42 m
health.state: stable
health.summary: 'Maintain recovery and readiness'
voicePhase: idle
```

## 5. State machine and coordination functions

Keep appearance and function in a single explicit state machine. The mic, orb, lens, waveform and input sheet must reflect **one authoritative voice phase**, not independent timers or uncoordinated booleans.

```text
idle --user click--> requesting_permission
requesting_permission --granted--> listening
requesting_permission --denied--> error
listening --speech endpoint--> transcribing
listening --user stop--> idle
transcribing --transcript ready--> thinking
transcribing --failure--> error
thinking --answer ready + TTS enabled--> speaking
thinking --answer ready + TTS disabled--> idle
speaking --audio ended--> idle
speaking --user interrupt--> requesting_permission/listening
any state --offline--> offline
error/offline --explicit retry--> idle
```

Function inventory (implement these as real, testable functions/hooks rather than only visual placeholders):

| Function/hook | Responsibility | Inputs → outputs |
|---|---|---|
| `useSkySceneModel()` | Single source of truth for UI presentation | providers + local state → `SkySceneModel` |
| `useMissionClock()` | Source-appropriate mission time/day | mission context → text/timestamp |
| `useVitalStream()` | Subscribe, validate, freshness-tag readings | sensor stream → typed readings |
| `formatVital()` | Exact reference-style number formatting | kind, reading → display text |
| `useValidatedHealthAssessment()` | Display trusted health rules result | verified rules/data → assessment |
| `useVoiceSession()` | Microphone permission, record/start/stop, ASR/TTS lifecycle | user actions → voice phase/events |
| `calculateRms()` | Voice amplitude from PCM samples | Float32Array → [0..1] |
| `smoothEnvelope()` | Smooth input/output sound energy | old/current/delta → normalized energy |
| `useOrbVisualState()` | Map voice phase to shader params | phase/energy → colors, noise speed, bloom |
| `useConversationContent()` | Contextual greeting, captions and answer | mission/agent context → DOM strings |
| `useProjectionController()` | Open/close metric and health details | selection → projected detail state |
| `usePerformanceTier()` | Auto-tune DPR, particle count, passes | device/fps → high/balanced/low |
| `useAccessibleMotion()` | Reduce motion and alternative feedback | OS preference/user setting → flags |
| `useCriticalAlertPresenter()` | Surface safety alerts above decorative layers | alert feed → accessible interruption |

## 6. Design tokens

All color samples are **visual approximations** to the screenshot, not colors extracted from source design tokens.

```css
:root {
  --sky-space-950: #04101e;
  --sky-space-900: #081b30;
  --sky-space-800: #102d4b;
  --sky-cyan: #6cecff;
  --sky-blue: #4bb8ff;
  --sky-lavender: #bfadff;
  --sky-magenta: #edb9ff;
  --sky-mint: #55e7b9;
  --sky-text-primary: #ecf7ff;
  --sky-text-secondary: #a8bdd0;
  --sky-glass: rgba(65, 147, 200, 0.065);
  --sky-glass-edge: rgba(142, 220, 255, 0.24);
  --sky-focus: #f1faff;
  --sky-font: 'Inter', 'Manrope', system-ui, sans-serif;
}
```

Typography target (estimated desktop sizes): branding 29–32px / letter-spaced; branding subtitle 17–18px; mission 16–18px; numeric vital values 23–25px; greeting 41–45px with light/normal weight; question 24–28px; `Stable` 34–38px; label text 17–19px; bottom prompt 19–21px. Prefer light/regular font weights and airy spacing; do not use aggressive sci-fi display fonts.

Visual rules:
- Predominantly dark navy and transparent blue, not black/opaque cards.
- Most visual mass is in the center Orb and lower fluid projection, not on text boxes.
- Thin, incomplete ring segments and smooth elliptical forms replace normal borders.
- Bloom must be selective, not a full-page blur; preserve sharp text and icon strokes.
- No persistent navigation sidebar, tab bar, dashboard grid, search box, or notification center.
- Critical textual content cannot be only within canvas/shaders.

## 7. Shader implementation notes

**Orb:** Three.js mesh/plane with `fresnel = pow(1.0 - max(dot(normal, viewDir), 0.0), exponent)` for edge radiance; domain-warped FBM/simplex noise for filaments; 2–4 translucent layers with independent angular velocities; cyan/blue/lavender gradient color map; selective bloom mask. Use a transparency/depth strategy that avoids sorting artifacts.

**Lens:** SDF-based elliptical shell with distance-dependent alpha and low-frequency edge deformation. Use two off-center blue/violet wisps and a subtle bright contour on one side. The lens should not become an opaque dialog.

**Organic surface:** 2D ribbon mesh or spline tessellation + vertex displacement. Add 1–3 thin bright curves and broad transparent luminous sheeting. Apply blend masking so the astronaut/desk reflection remains visible.

**Holographic figure:** Glowing rim/edge from fresnel, pale inner fill, modest scanline noise (very faint), body outline. Build semantic regions separately; a skeletal pose is optional but not necessary for the screenshot's pose.

**Waveform:** A DOM SVG path or Canvas2D line driven by smoothed amplitude; cost does not justify running a separate WebGL renderer. The resting reference includes a narrow central pulse in a mostly flat line.

**Performance:** Cap device pixel ratio (e.g. 1.5–2 where appropriate), use a single main 3D renderer/canvas where feasible, avoid multiple independent requestAnimationFrame loops, pool geometries/textures, and reduce shader layers according to runtime frame-time. Do not sacrifice data readability to maintain 60 fps. On low-end systems provide a static composited fallback.

## 8. Responsive and interaction rules

**Wide workstation (>=1440 CSS px):** all screenshot projections visible in the same composition. Size from a logical frame with anchor-based positions to preserve composition.

**Laptop 1024–1439px:** reduce orb 10–18%, tighten side clusters, reduce decorative effects; do not overlap greeting/status; allow metric detail projection overlaid on demand.

**Tablet 768–1023px:** central orb + greeting and voice control remain; vitals represented by a compact curved cluster; health view projected when invoked.

**Phone <768px:** center orb, readable health summary, large microphone and an accessible compact vitals affordance. Background reframed; do not flatten full screenshot into unreadably small controls. Keep the alien/organic visual vocabulary.

**Interaction methods:** mouse, keyboard, touch, optional speech; touch does not require hover. Screen readers should receive a coherent semantic linear reading order, not the painter's z-order. Space/Enter activates microphone. Escape closes contextual projection; alert flows need their own explicit acknowledgement. All actions have visible focus and feedback.

## 9. Accessibility, clinical safety and privacy

- All health readings must include provenance, timestamp and sensor-quality metadata in detail view.
- Status/diagnostic claims may only come from trusted assessment logic. Missing data ≠ normal; a green mock `Stable` reference cannot be treated as a clinical conclusion.
- Critical physiological alarms bypass the conversational UI and remain legible even if shader rendering, voice recognition or the AI service is down.
- Present state with text/icon as well as color; no alarming flicker; respect reduced motion.
- Never start microphone capture or send audio to services until explicitly activated with permission. Show active recording state and control.
- Support typed input, transcript display, and voice-off mode.
- Make sure a completely offline mission configuration can still render essential telemetry and alert states.

## 10. Source structure (proposed)

```text
src/sky/
  SkyScreen.tsx
  SkySceneLayout.tsx
  components/
    SkyIdentity.tsx
    MissionContext.tsx
    VitalsProjection.tsx
    VitalMetric.tsx
    ConversationLens.tsx
    AICoreOrb.tsx
    GreetingPrompt.tsx
    LiveVoiceWaveform.tsx
    HealthProjection.tsx
    HumanHologram.tsx
    OverallHealthSummary.tsx
    OrganicInputSurface.tsx
    MicrophoneOrb.tsx
    VoiceHint.tsx
    ContextProjectionLayer.tsx
    CriticalAlertLayer.tsx
  graphics/
    SpaceSceneBackground.tsx
    ViewportFrameFX.tsx
    OrbMaterial.ts
    OrganicLensMaterial.ts
    FluidSurfaceMaterial.ts
    HologramMaterial.ts
  hooks/
    useSkySceneModel.ts
    useVitalStream.ts
    useMissionClock.ts
    useVoiceSession.ts
    usePerformanceTier.ts
    useAccessibleMotion.ts
  domain/
    types.ts
    healthAssessmentAdapter.ts
    formatting.ts
    fixtures.ts
  styles/
    tokens.css
    scene.css
  tests/
    screenshot.spec.ts
    voice-state.spec.ts
    vitals.spec.ts
    accessibility.spec.ts
```

## 11. Acceptance tests

### Fidelity

- At 1672 × 941 viewport, match the original composition, character location, Earth horizon, color atmosphere, projected-glass panels, floating orb size/position, text hierarchy and main-wave surface.
- Use image overlay/difference views during implementation, but account for animated elements by freezing a deterministic phase and seed.
- A high percentage of pixel similarity can only be judged after source-quality background assets exist; do not assert pixel-perfect reproduction before measurement.
- No standard app chrome may be added. No extra visible controls in idle beyond reference unless required for privacy/accessibility/safety.

### Functionality

- Clicking each of four vitals opens the correct detail with real or clearly labeled fixture data; Escape closes it.
- Clicking/tapping microphone requests permission, then begins capture, then stops on next user action; denied permission has a text fallback.
- Orb, waveform, lens, surface, helper text and captions transition together through idle/listening/transcribing/thinking/speaking/error/offline states.
- Clicking health hologram or summary opens details without replacing the entire scene with a generic dashboard.
- `Unknown` and `stale` sensor data are visibly distinct from `Stable`/normal.
- App remains usable by keyboard and with reduced motion; disabled WebGL still displays critical data and voice access.
- Resizing to tablet/phone does not clip vital interaction or overlap labels.

## 12. Implementation directive to an AI coding agent

> Read `SKY_UI_COMPONENT_FUNCTIONAL_SPEC.md` and the supplied reference image. Implement the complete SKY screen in the existing codebase, matching the **rendered picture** rather than inventing a normal SaaS dashboard. First inspect the repository frameworks, existing state/data APIs, asset library and run commands. Create the individual React components, rendering layers, visuals and shader effects described in the spec. Preserve the original screenshot's composition at 1672×941 and build responsive scenes for smaller screens. Use real SVG/DOM for text and accessible controls; use WebGL shaders for the orb, lenses and fluid surface. Keep one authoritative voice state machine. Wire all screenshot components to functioning interactions, use explicitly labeled screenshot fixture values only where real services are not available, and never fabricate medical conclusions. If the original art for space/astronaut/Earth or human hologram is unavailable, report the missing asset and implement a visually consistent placeholder, rather than pretending the screenshot itself is a functional UI. Produce visual-regression screenshots and functional tests, run the app, fix errors, and report any remaining fidelity differences.
