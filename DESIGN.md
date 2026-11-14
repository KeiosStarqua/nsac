# SKY / DESIGN.md

> **SKY — The Quiet Instrument**  
> Design system, product interaction contract, and implementation specification for the astronaut wellness companion.  
> **Version:** 1.0.0 · **Date:** 2026-11-14 · **Status:** Design proposal / implementation target  
> **Primary stack:** TypeScript + Bun; React web interface; schema-constrained OpenUI-generated projections.  
> **Design intent:** Feels like a crew instrument with a living presence—not a SaaS dashboard wearing a space-themed wallpaper.

---

## 0. How to use this document

This is the **product-wide design source of truth**: product posture, screen architecture, visuals, interactions, safety hierarchy, design tokens, component API, responsive rules, generative UI constraints, and acceptance tests. It is intended to be copied into the Sky repository as `DESIGN.md` and used by implementation agents.

When this document conflicts with a screenshot, follow the **behavior and safety rules here** and then preserve the reference screenshot's strongest visual characteristics. When it conflicts with validated medical rules or mission operations, the validated rules take precedence. `DESIGN.md` does not define diagnostic thresholds or qualify the product as flight hardware or a medical device.

### Source and authority boundaries

- **Reference A — crew selection screenshot:** Dark rectangular roster frame, three crew choices, small role/call-sign labels, explicit Continue and `1/2/3` keyboard access. It is a working functional seed, **not** the final visual grammar.
- **Reference B — SKY console screenshot:** Full-bleed spacecraft window with Earth, peripheral vitals at left, AI orb center, body hologram at right, translucent voice horizon at bottom. This establishes the spatial hierarchy and experiential ambition; the background is illustrative, not live flight data.
- **`STORY.md`:** Fictional narrative context; not a medical source. Its *Hồng Hạc* crew and journey are distinct from the screenshot's sample ISS scenario.
- **`ARCHITECTURE.md` and `README.md`:** Existing feature semantics (personal baseline, deterministic deviations, readiness, astronaut confirmation, delayed Earth report). Older copies may describe Python. **The current project direction is TypeScript + Bun**, and implementation must inspect the current repo before choosing paths.
- **`SKY_INTRA_TURN_SPEC.md` and `SKY_UI_COMPONENT_FUNCTIONAL_SPEC.md` where present:** Additional design inputs; this document supplies their product-wide visual and interaction integration.
- **External standards:** NASA-STD-3001 Volume 2 / crew interfaces; WCAG 2.2 AA as accessibility design inputs. Neither reference implies NASA approval or a tested compliance claim.

### Normative vocabulary

- **MUST / MUST NOT:** Release-blocking product behavior.
- **SHOULD:** Default implementation; deviations require an explicit reason.
- **MAY:** Optional capability.
- **PROPOSED:** Target not yet demonstrated in code or validated in user testing.

### Screenshot discrepancy that MUST be fixed

The two references disagree: screenshot A selects **Ayla Reyes / Dae-Jung Park / Lena Fischer**; screenshot B greets **Minh**. The mission label reads **ISS · Day 170**, while `STORY.md` describes a fictional Mars journey with **Minh, Linh, Ana, Kenji**. Do not merge these into a single fictitious crew. Define named fixture configurations:

| Fixture | Crew | Mission | Use |
|---|---|---|---|
| `iss-showcase` | Ayla, Dae-Jung, Lena | ISS / Day 170 | Public screenshot reproduction only |
| `hong-hac-story` | Minh, Linh, Ana, Kenji | Hồng Hạc / Mars transit | Narrative + story-driven demo |
| `operator-local` | Identified local users | Explicit mission configuration | Actual local app session |

The roster, greeting, mission stamp, telemetry, report sender, and audit identity MUST derive from the **same active fixture/session context**. No hardcoded greeting. All sample fixtures display **SIMULATED** in a visibly readable way, not only in 10px footer text.

---

# PART I — DESIGN DNA

## 1. The premise

**Sky is a quiet instrument that notices change and asks for one good decision.**

It is not a doctor avatar, control center, chatbot pasted onto a dashboard, or sci-fi game HUD. The astronaut is the operator. Sky watches trends relative to that individual's baseline, makes uncertain evidence legible, proposes the next reviewed action, asks for human confirmation, and keeps a verifiable record. In weak connectivity it remains useful; in failure it becomes simpler, never more magical.

### Four irreducible qualities

1. **Presence without personality theater.** The orb signifies whether Sky is available, listening, reasoning, or awaiting an answer. It has no eyes, face, dramatic heartbeat, or anthropomorphic emotions.
2. **Calm until there is a reason not to be.** The normal state is nearly still. Attention is a scarce visual resource. Safety signals override the ambient scene without animation tricks.
3. **Embodied information.** A reading lives near the body system it describes; a decision appears attached to the evidence that produced it; a transmission has an observable path and delay.
4. **Human authority.** Sky may explain or draft. It cannot silently decide that a physiological state is safe, prescribe unreviewed treatment, or dispatch a message requiring crew confirmation.

### The one-sentence design test

> Can a tired astronaut answer **“What changed, how sure are we, and what should I do next?”** within the same calm visual field?

If a beautiful screen fails this test, redesign it.

## 2. Anti-slop rules (non-negotiable)

The project has to be recognizable **without its logo**. Reject the following common AI-generated interface defaults:

| Avoid | SKY replacement |
|---|---|
| Left navigation sidebar + top navbar | Contextual **flight strip** and an opt-in **focus map**; no persistent app chrome |
| 4–8 equal KPI cards | One meaningful **signal well**, with details revealed only on intent |
| Every surface a glowing rounded rectangle | **Apertures, horizons, tethers, instrument cuts**; cards only where accessibility demands |
| Purple–cyan gradient covering everything | Limited-color luminous accents on an almost black mineral background |
| Pulsing AI ball 24/7 | Nearly still orb at rest; state-linked change only |
| 3D human body as decoration | Semantic selectable body systems, with data confidence and accessible alternate view |
| Random particles, starfields, blurry glass everywhere | Explicit scene art in ambient layer, no visual noise across reading surfaces |
| Green “Stable” after missing data | Distinct **unknown / stale / invalid** states; never infer normality from absence |
| “AI-powered insights” marketing copy | Plain operational copy with evidence, time, confidence, and a next step |
| Tiny, dim, all-caps microtext | Readable text, mixed-case labels, monospace only for measurements and IDs |
| 20 chart types per screen | One comparison that answers the active question; inspectable source data |
| Arbitrary generated components | Strict registry, constraints, review, deterministic data selectors |
| Neon red emergencies | High-contrast safety curtain; alarm text and instructions are primary |
| Fake oscilloscope health lines | A waveform only when actual audio/physiological samples drive it |
| “AI doctor says...” | “Sky found…” + evidence + “Review / Confirm / Decline” |

A screen can be visually rich. It cannot be **visually indiscriminate**.

## 3. Form language: the Canopy, the Aperture, the Horizon, the Tether

Four forms create the entire identity. They are not four arbitrary decorative components; each has a semantic role.

### 3.1 CANOPY — the environment

A gently framed, full-bleed operating space. In the screenshot it is the spacecraft window. The frame never competes with content. The Canopy may be a depth-rendered scene, a subdued flat gradient, or plain near-black according to performance and operating mode.

- Typical use: home presence, mission perspective, distant Earth, environmental context.
- Never: putting vital numeric data directly over bright ocean art.
- Geometry: 2–3 broad arc segments, thickness 1–2px, asymmetrical; **no glowing rectangular frame around every page**.

### 3.2 APERTURE — a focus window

A deliberate, softly bounded ellipse or cutout that gathers attention around a subject: Sky's orb, a selected organ, a patient-specific baseline, or a decision. Its geometry is not always a perfect circle; it stretches along the axis of the content it holds.

- Typical use: AI presence, body exploration, focused metric, review.
- At rest: faint 1px outline or light falloff, never spinning rings.
- On focus: one thin directional segment reveals where content came from.

### 3.3 HORIZON — a working surface

A horizontal, flowing seam anchored near the lower third. It is where the operator speaks, types, confirms, or reviews. Think of an instrument's workbench, not a chat bubble tray.

- Typical use: composer, microphone, action decision, protocol progress.
- Shape: restrained shallow arc, stretched across the available working width.
- Must provide a **flat, opaque text reading layer** if imagery lies beneath it.

### 3.4 TETHER — evidence relationship

A thin line, small anchor label, or spatial alignment makes an origin visible: a metric to a body region, an alert to its rule, an action to its supporting evidence, a report to its transmission queue.

- Tethers are not decorative graph edges. They imply a real selectable relationship.
- Maximum two visible tethers in the ambient home scene; extras become visible on focus.
- Never let tethers cross safety text or intercept interactions.

### Form invariants

- Shapes are intentionally **asymmetric**: left health telemetry, center companion, right body; not a perfectly mirrored HUD.
- Most large shapes have no border; **one edge** or light grazing is enough.
- Use curves for orientation and exploration, straight cuts for precision and irreversible decisions.
- Critical actions are visually **less alien** than the ambient interface—clear rectangles, direct labels, conventional focus states.

## 4. Light budget

Sky uses illumination as an information hierarchy, not as a theme effect.

| Layer | Typical luminance treatment | Permission |
|---|---|---|
| Ambient scene | Very dark, low-saturation, low-detail | Always; can be disabled |
| Idle orb | One thin rim and restrained interior texture | Presence only |
| Live observation | Quiet neutral/frost text, short accent segment | Verified data available |
| Focus | One localized teal or silver highlight | User is inspecting |
| Proposed action | Warm pale metal edge, matte background | Needs review |
| Warning | Amber text + explicit status icon/word | Reviewed rule fired |
| Critical | Opaque high-contrast region, no background glow | Immediate attention |

**Maximum one primary bright focal object at a time.** When the body is active, dim the orb. When a decision is active, the decision occupies the focus; decorative graphics step back. Avoid simultaneous glowing metrics + orb + body + action strip.

## 5. Brand voice

Sky sounds like a competent crew partner. Its personality is **in the quality of its attention**, not witty lines.

- Direct, sparse, no motivational slogans or cosmic metaphors in operational modes.
- Sentences usually under 18 words; action labels are verbs with objects.
- Uncertainty is explicit: “Sleep data stopped 43 min ago.” / “This trend is based on 6 valid readings.”
- Do not pretend to feel emotions: avoid “I am worried,” “I know you're fine.”
- In urgent states, skip the greeting and pleasantries.
- Never say “diagnosed” unless the application has a validated mechanism and appropriate review.

**Examples**

| State | Good | Bad |
|---|---|---|
| Idle | “Good morning, Minh.” | “Greetings, space explorer!” |
| Difference | “Your resting heart rate is above your recent baseline.” | “Your heart is in danger!” |
| Incomplete | “Last oxygen reading: 09:14. No current reading.” | “Oxygen stable.” |
| Action | “Review a lighter exercise session.” | “I prescribed your recovery workout.” |
| Report | “Ready to queue for Earth. Review before sending.” | “I've informed mission control.” |
| Disconnected | “Local monitoring continues. Earth link unavailable.” | “All systems online.” |

---

# PART II — PRODUCT TOPOLOGY

## 6. The interface is a space, not a collection of pages

The operator does not navigate a menu tree first. The ambient presence is a **starting coordinate**, and focused information approaches the operator as a projection.

```
                          MISSION / LINK / TIME
                                   ·
                 VITAL SIGNALS  ── SKY ──  BODY / RISK
                                   │
                              WORK HORIZON
                                   │
           HISTORY / EVIDENCE ─ DECISION ─ REPORT / EARTH
```

This is an **interaction topology**, not a literal on-screen diagram. The visual home retains left–center–right–bottom anchors from the supplied reference.

### Primary concepts

1. **Presence:** where the astronaut starts a conversation and sees the one most relevant change.
2. **Signals:** individual measurements, sensor quality, and baseline comparisons.
3. **Body:** selectable system map, anatomical explainer, and related evidence.
4. **Readiness:** transparent readiness estimate with uncertainty and per-factor contribution.
5. **Protocol:** reviewed action and exercise or safety checklist with crew confirmation.
6. **Timeline:** what happened, what changed, who acknowledged, and why.
7. **Earth:** pending, delayed, transmitted, failed, and acknowledged messages.
8. **Crew / Mission:** identity, roles, local access, connection policy, and mission context.

### Navigation rule

No permanent sidebar. Entry occurs by natural language (“Show my cardiovascular trend”), keyboard command (`Ctrl/Cmd+K`), tapping a visible semantic anchor, or opening the **Focus Map** via the SKY ring. The Focus Map is a bounded overlay with 6–8 named destinations and a fixed order; it is not a hidden feature labyrinth. It remains usable offline and without AI.

### Focus state stack

`presence -> subject focus -> evidence -> decision -> confirmation -> return`

- Focus changes are reversible with **Back**, `Esc`, or a visible **Return to presence** action.
- At most two nested exploratory projections; deeper information moves to a readable document view with a breadcrumb, not a stack of overlays.
- Emergency curtain and queued confirmation persist independently of focus navigation.
- The app remembers active astronaut and previously visited focus, but never restores a stale approval dialog as already approved.

## 7. Information authority and safety hierarchy

Every piece of on-screen information belongs to one of these sources:

| Authority | May display | May trigger critical alarm? | May author medical threshold? |
|---|---|---|---|
| A0 — reviewed safety engine | Evaluated rule, priority, recommended review path | **Yes** | Only through separately reviewed configuration |
| A1 — measured or validated derived data | Reading, trend, timestamp, quality, baseline, algorithm ID | No, unless evaluated by A0 | No |
| A2 — approved procedure catalog | Clinical/exercise step, citations, validity conditions | Not directly | No; provided by review process |
| A3 — reasoning/generation agent | Explanation, alternatives, clarification, proposed layouts | **Never** | **Never** |
| A4 — scene/presentation | Visual metaphor, decorative anatomy, animations | **Never** | **Never** |

The UI **MUST NOT** let a generated label override an A0/A1 value. Words like “Stable,” “Clear,” and “Safe” require a corresponding trusted assessment and its coverage criteria. No reading means **UNKNOWN**, not green.

### Operational modes

| Mode | Default visuals | Interaction priority |
|---|---|---|
| `showcase` | Cinematic, clearly marked simulated | Demonstrate storytelling safely |
| `daily` | Calm scene, restrained motion | Observe, ask, review daily action |
| `focused` | Dim background, foreground evidence | Interpret one subsystem |
| `procedure` | Opaque work surface, explicit steps | Complete and confirm a protocol |
| `caution` | Increased text contrast and priority | Review abnormality promptly |
| `critical` | High-contrast safety curtain | Follow reviewed emergency workflow |
| `degraded` | Flat instrument mode, minimal compute | Retain essential data and alarms |
| `offline` | Normal local operation with link state | Never equate offline with system failure |

`offline` is a connectivity dimension and can coexist with any other mode; implement as orthogonal state, not a single mutually exclusive enum.

---

# PART III — VISUAL DESIGN SYSTEM

## 8. Palette: Mineral Night

The reference uses cyan/blue/violet glow. Keep its oceanic feeling, but make it quieter, warmer, and more credible. **No generic indigo gradient.** Choose deep mineral blacks, chalk-white typography, sea-glass luminous accents, and warm safety metals.

All values below are **proposed design tokens**, not exact colors sampled from the screenshots. Validate contrast in the real DOM.

### 8.1 Primitive colors

| Token | Hex | Role |
|---|---|---|
| `void-950` | `#050A11` | Almost-black application background |
| `void-900` | `#08121C` | Main Canopy |
| `slate-850` | `#0D1C28` | Low elevation body / chart surface |
| `slate-800` | `#142634` | Opaque work Horizon |
| `slate-700` | `#28404B` | Hairlines and secondary boundaries |
| `chalk-100` | `#EDF4F1` | Primary text |
| `chalk-200` | `#D4E2E0` | Secondary text on dark surfaces |
| `chalk-350` | `#9EB7BC` | Supplementary text |
| `sea-300` | `#9AE6DA` | Focus and high-confidence interaction |
| `sea-400` | `#66C9C0` | Quiet confirmed controls |
| `ice-300` | `#A9CFE2` | Neutral measured data / sensor plots |
| `lilac-300` | `#B5B9D9` | Memory / history / sleep only |
| `amber-300` | `#E8C48A` | Caution and pending confirmation |
| `coral-300` | `#F0ADA2` | Critical accents, together with clear text |
| `graphite-100` | `#10191E` | Text on pale focus buttons |

### 8.2 Semantic colors

```css
:root {
  color-scheme: dark;
  --sky-bg: #050a11;
  --sky-canopy: #08121c;
  --sky-surface: #0d1c28;
  --sky-surface-raised: #142634;
  --sky-line: #28404b;
  --sky-text: #edf4f1;
  --sky-text-secondary: #d4e2e0;
  --sky-text-muted: #9eb7bc;
  --sky-focus: #9ae6da;
  --sky-measure: #a9cfe2;
  --sky-history: #b5b9d9;
  --sky-caution: #e8c48a;
  --sky-critical: #f0ada2;
  --sky-on-focus: #10191e;
  --sky-safe-action: #66c9c0;
  --sky-veil: rgba(5, 10, 17, 0.88);
  --sky-hairline: rgba(169, 207, 226, 0.24);
  --sky-focus-ring: 0 0 0 3px #edf4f1;
}
```

Use alpha only for decorative separation; **body text MUST appear on a reliably opaque enough backdrop**. The status categories are `normal`, `watch`, `action_required`, `critical`, `unknown`, and `invalid`; the semantic *color* alone is not the state model.

### 8.3 Color operating rules

- Health data lines: one neutral ice color. Comparisons use *line style, labels, and shape*, not just a second color.
- Sea-glass teal is for the **currently actionable object**. Do not make every number teal.
- Amber indicates `review required`, not vague enthusiasm.
- Red/coral is reserved for reviewed urgent conditions and serious failures. Do not use red to dramatize AI-generated text.
- Purple/lilac is extremely rare (history/sleep contextual accent), never the default hero glow.
- Provide a monochrome/increased-contrast mode with pattern and text redundancy.

## 9. Typography: human + instrument

Use two voices, not seven weights of the same geometric font:

- **Human layer:** `Newsreader` or a vetted equivalent editorial serif for occasional large greeting and humane reflection. Maximum one hero phrase on a screen. Never use serif for alerts, measurements, buttons, or dense charts.
- **Instrument layer:** `IBM Plex Sans` for interface and readable explanation; `IBM Plex Mono` for IDs, timestamps, units, provenance and numeric readouts. Self-host locally under verified font licenses; no CDN required at runtime.

| Role | Font / size | Weight | Behavior |
|---|---|---|---|
| Hero human greeting | Newsreader / clamp(28px, 3vw, 46px) | 400 | 1–2 lines max |
| Focus title | Plex Sans / 28–36px | 450–500 | Normal case |
| Status conclusion | Plex Sans / 26–34px | 500 | Text plus state icon |
| Metric number | Plex Sans tabular / 25–36px | 400–500 | Unit separate |
| Main body | Plex Sans / 16–18px | 400 | Line-height 1.45–1.6 |
| Control | Plex Sans / 16–18px | 500–600 | Explicit verb |
| Data/metadata | Plex Mono / 12–14px | 400 | Labels, timestamps only |
| Assistive caption | Plex Sans / >=14px | 400 | Never rely on opacity < readable threshold |

- Lowercase/Title case for labels. All caps only for short call signs (`CDR-01`) or severity stamps (`SIMULATED`, `CRITICAL`), with accessible labels.
- Prefer **tabular numerals** for measurements. Never bold an entire paragraph.
- Minimum normal UI reading size: 16px in desktop and mobile; metadata can be 12–14px if nonessential, with enlarged accessible option.
- Do not stretch text with tracking to look futuristic.

## 10. Layout geometry

### 10.1 Coordinate system

Sky uses anchor-based **composition**, not fixed pixel positions. Primary content is HTML/DOM; decorative layers can use Canvas/WebGL.

- Safe viewport: `100dvh`, with explicit `env(safe-area-inset-*)` support.
- Desktop scene maximum content breadth: 1720px, centered; background remains full-bleed.
- Minimum edge margin: `max(24px, 3vw)`; mobile 16–20px, plus safe area.
- Default spacing unit: 4px; steps 8 / 12 / 16 / 24 / 32 / 48 / 64.
- Maximum prose width: 62–72 characters per line.
- Near-Horizon controls must remain above device bottom safe areas.

### 10.2 Wide scene layout (>= 1440 CSS px)

```
┌─────────────────────────────────────────────────────────────────────┐
│ SKY ring / identity                     MISSION · DAY · LINK       │
│                                                                     │
│  [signal well]         [SKY aperture / orb]       [body projection] │
│  measurement           attention / greeting        overall context  │
│  evidence              asked question              selected system  │
│                                                                     │
│                    [organic working horizon]                       │
│                          voice / type                               │
└─────────────────────────────────────────────────────────────────────┘
```

Target visual distribution (approximate, not fixed bounding boxes): **left 20%, center 54%, right 26%**. Orb center at ~50% viewport width and ~30% height. Working Horizon starts ~69% height; never place interactive text on top of the saturated Earth limb from the concept image.

### 10.3 Laptop (1024–1439 CSS px)

Preserve center aperture and work Horizon. Compress left vital readouts into 2×2 instruments without individual boxes. Right body preview becomes a smaller anchor. Full evidence detail overlays the center *instead of squeezing three columns*. Everything readable at 125–200% text zoom.

### 10.4 Tablet (768–1023 CSS px)

The orb and active prompt occupy the main field. Vitals form a shallow upper/side strip; the body sits behind a selectable anchor, not a miniature human diagram with illegible labels. Text and actions remain DOM. Work Horizon can grow upward when typing or performing a protocol.

### 10.5 Phone (< 768 CSS px)

One focal object at a time: current priority, then orb/greeting, then voice/text. Signal summary and body details are accessible by one tap or Focus Map. No shrinking desktop screenshot to phone width. No requirement to scroll a full-page list to find a critical alert; a safety curtain is pinned at screen top and accessible in reading order.

### 10.6 Watch / wearable

Not a miniature Sky homepage. Display only user identity, one verified priority or one current vital with freshness, and one action (acknowledge, view on console, request assistance). Urgent alert surfaces must use platform-accessible haptics and clear text when available; the watch must not imply validated monitoring if it merely mirrors a connected app.

### 10.7 Large spacecraft/room display

Presenter or shared view: avoid private personal details by default, provide explicit crew selection and screen privacy controls, increase readout scale to viewing distance, and make prompts operable by remote keyboard/touch. Do not assume all spacecraft surfaces are interactive or medically certified.

## 11. Depth, texture, and animation

### Depth layers (strict order)

1. `z-ambient`: static space/ship/abstract environment; decorative only, `pointer-events: none`.
2. `z-orbit`: Canopy rim, distant arcs, limited atmosphere.
3. `z-data`: vitals, body, readings, labels—DOM and accessible SVG.
4. `z-focus`: active aperture and evidence projection.
5. `z-work`: Horizon, composer, controls, confirmations.
6. `z-safety`: alarms/critical curtain; above all effects, including modals.

Do **not** move focusable DOM nodes behind opaque 3D rendering or rely on depth for reading order.

### Motion grammar

| Event | Response | Suggested duration |
|---|---|---|
| Orb idle | Almost motionless; slow diffusion only in high-quality mode | 8–14s low-amplitude cycle, optional |
| Orb listening | Inward breathing tied to **actual audio amplitude** | Audio-driven, no fabricated spikes |
| Orb thinking | Light gathers briefly along one seam | 350–700ms transition; no endless loading show |
| Projection opens | Origin tether appears; evidence settles | 220–320ms |
| Focus changes | Previous field dims; new field emerges | 180–260ms |
| Approved action | Short closure pulse + durable log state | 150–250ms |
| Critical alert | **No animation required**; immediate opaque display | 0ms gate |

Never animate a medical number between values as if it is continuously sampled when updates are sparse. Prefer `prefers-reduced-motion` and a user motion-off switch; in those states all states are communicated instantly via text/shapes.

### Effects budget

- At most 1 primary WebGL scene, 1 body renderer, 1 extra postprocess pass in cinematic mode.
- No expensive blur over large continuously changing layers.
- Dynamic particle effects, if any, are scene metadata, not signal visualization.
- A static bitmap/gradient path MUST look like Sky, not like a broken fallback.
- Default to a low-motion, reduced-glow `operator` profile for real monitoring.

---

# PART IV — SIGNATURE COMPONENTS

## 12. Component vocabulary

Each primitive has an accessible role and a limited appearance grammar. **A component name is not permission to render an arbitrary shape.**

| Component | What it is | Primary states | Semantics |
|---|---|---|---|
| `SkyCanopy` | Responsive ambient field, optional artwork | cinematic / quiet / flat | presentation only |
| `SkySeal` | Brand/identity ring, Focus Map entry | idle / focused / offline | button + accessible name |
| `MissionStamp` | Mission, day, time, link condition | available / queued / link lost | status + details |
| `CrewBeacon` | One crew member's clear selectable identity | selected / unselected / restricted | radio/list option |
| `PresenceAperture` | Center focus with bounded light | resting / focused / awaiting | region |
| `SkyCore` | Orb state visualization | idle / listening / working / speaking / halted | decorative + separate SR text |
| `SignalWell` | Vital summary anchored left | good / missing / stale / invalid / highlighted | structured list |
| `SignalTrace` | Time trend with baseline reference | loading / ready / incomplete | SVG chart + table alt |
| `BodyVolume` | 3D/holographic anatomy exploration | overview / system / selected organ | 3D with accessible tree |
| `HorizonComposer` | Voice, typing, intent preview | idle / recording / transcribing / proposed | form |
| `EvidenceRibbon` | Readings, rule ID, calculation, source | collapsed / expanded / unavailable | disclosure |
| `TetherProjection` | Spatial relation from origin to detail | opening / open / closing | region/dialog as appropriate |
| `DecisionSlate` | Reviewed action and alternatives | proposed / confirming / committed / declined | form/dialog |
| `ReadinessDial` | Decomposable readiness assessment | calculated / incomplete / not available | meter only if legitimate |
| `ProcedurePath` | Stepwise protocol | active / paused / done / unsafe | ordered list |
| `PacketTrail` | Communication queue history | draft / queued / in transit / delivered / failed | timeline |
| `SafetyCurtain` | Highest-priority accessible alert | caution / critical / acknowledged | alertdialog / alert |
| `FocusMap` | Canonical non-AI navigation fallback | open / closed | dialog/menu/list |
| `SimulationMark` | Durable, visible sample data label | simulated | text, not ornament |

### Components intentionally not defined

No generic `GradientCard`, `StatCard`, `NeonBadge`, `ChatBubbleList`, or `MagicOrbButton`. Shared primitives can exist inside implementation, but they MUST NOT impose conventional dashboard styling on product-level components.

## 13. SkyCore and voice behavior

Orb color is **not** health status. It reflects the assistant's interaction state only.

```
quiet
  ├─ mic/tap → permission-request → listening → transcribing → reasoning
  │                                                        ├─ response → speaking/quiet
  │                                                        └─ action proposal → awaiting-confirmation
  ├─ text submit ────────────────────────────────────────────┘
  └─ critical-safety-event → orb deemphasized; safety curtain visible
```

Core appearance by state:

| State | Visual | Required equivalent text |
|---|---|---|
| `quiet` | Dim stationary sea-glass seam | “Sky is ready.” |
| `permission-request` | No fake waveform | “Microphone access requested.” |
| `listening` | One directional breathing rim + real mic energy | “Listening. Stop recording.” |
| `transcribing` | Orb settles, transcript takes focus | “Transcribing...” |
| `reasoning` | Brief gathers of light; plain progress text | “Reviewing your request.” |
| `speaking` | Small measured output modulation, optional | “Sky is speaking. Stop playback.” |
| `awaiting-confirmation` | Orb retreats; DecisionSlate takes focus | “Action awaiting your confirmation.” |
| `unavailable` | Neutral unlit circle | “Assistant unavailable; local monitoring continues.” |

Voice MUST be opt-in, never ambient hot-mic by default. On-screen transcript is visible and editable before consequential actions. Stop, interrupt, and turn off voice are always available. If speech services are unavailable offline, typed interaction remains functional.

## 14. SignalWell (vitals)

The screenshot's four signals—heart rate, respiratory rate, oxygen saturation, and sleep—define the calm cluster. The real dataset can expand to HRV, BP, activity, exercise adherence, muscle/strength measurements, environmental exposure, and other validated feeds through the Focus Map.

### Summary signal

```
 HEART RATE
 62 bpm     09:14 · sensor current
 Compared with your baseline: +4 bpm (7-day median)
```

Only the active signal shows full baseline relation; remaining signals show a short numeric readout and an explicit freshness state where needed. Baseline period is configurable and visually named; do not infer a seven-day baseline if no such data exists.

### Signal focus view

- Title, physiological unit, valid sample coverage, current/recent value, baseline method/period, trend, deviation finding, source timestamp.
- The chart uses an actual time axis, shaded baseline reference and missing-data gaps; no interpolation across disconnected samples.
- Explain measurement quality and sample rate.
- Evidence details show rule ID, threshold version, method, and source; users can inspect raw readings where authorized.
- The chart is keyboard-navigable and has an equivalent data table and succinct text summary.
- The system supports **UNKNOWN**, **STALE**, **INVALID**, and **DEVICE DISCONNECTED** as distinct states.

## 15. BodyVolume (3D body)

The right hologram is a **navigation object**, not a medically authoritative scan. Build it as a selectable anatomical atlas with progressive depth. It may rotate and zoom for explanation but must never imply that organ-specific data exists where none was measured.

### 15.1 Levels of detail

| Level | Content | UI behavior |
|---|---|---|
| L0 silhouette | Entire body, neutral outline | Select system: cardio, respiratory, musculoskeletal, nervous, immune, etc. |
| L1 system | Grouped anatomical structures | Expose available measurements and coverage |
| L2 organ/region | Selected organ and adjacent context | Zoom, label, source links, evidence projections |
| L3 evidence | Timeseries, model/rule context, uncertainty | Opaque readable DOM surface |

### 15.2 3D rules

- Must have a synchronized accessible **Body Tree** (text list with system, organ, availability), selectable by keyboard and screen reader.
- Labels and readings are DOM overlay, never permanently baked into a texture.
- Drag to rotate, wheel/pinch to zoom, click to select; offer rotate buttons and zoom buttons for non-drag interaction.
- Limit zoom to prevent clipping/camera penetration; add **Reset View**.
- Highlight organs only when selection/context demands it; no perpetual glowing organ outlines.
- Give a `measured`, `derived`, `estimated`, `not measured` label for every medically meaningful overlay.
- **Never** show simulated radiation organ dose as actual measurement; anatomic heatmaps require a documented measurement/model chain.
- Keep geometry, organ labels, license, and source version tracked in the asset manifest.
- If 3D fails, show a 2D diagram and Body Tree with equivalent functionality.

### 15.3 Medical interpretation boundary

BodyVolume can explain relationships: “Cardiovascular findings involve this system.” It cannot say “this artery is blocked” based on a heart-rate trend. Descriptive anatomy and diagnostic assertions are completely separate types.

## 16. HorizonComposer and OpenUI

The work Horizon is the one shared place where speech, typed requests, inline clarification, and confirmations happen.

### Idle

Text: **“Ask Sky about your health or mission.”**  
A clear `Start voice` affordance plus `Type a question`. For a demo, “Just talk to me…” may appear as an ambient tagline, but never substitute for an accessible, actual input label.

### During input (intra-turn interaction)

Support two optional interaction patterns from the project's intra-turn spec:

1. **Feedforward:** While the astronaut composes a request, show a *non-executing* preview of how Sky currently understands the intent: “Comparing sleep with your baseline · 7 days · Minh.” This preview must be visually distinct from a completed answer. No tool execution or clinical conclusion occurs during preview.
2. **Leaving Blanks:** Sky may leave one unresolved field in a proposed plan: “Compare [time range]” or “Create report for [crew member].” The astronaut fills it inline, with accessible controls, before committing the full action.

Preview generation is revisioned and cancellable. Superseded previews cannot overtake the current intent. Changing target person, time range, evidence, action, or transmission recipient invalidates dependent confirmations. No irreversible action from preview alone.

### Consequential actions

Any action that creates a durable clinical note, marks a procedure completed, changes crew-visible safety state, or queues an Earth report uses a **DecisionSlate** with explicit Confirm/Decline and an audit entry. The agent may assemble but not bypass the gate.

---

# PART V — COMPLETE EXPERIENCE INVENTORY

## 17. The 14 canonical experience states

These are **experience states**, not mandatory URL routes. They share the same Canopy, anchors, accessibility rules, and Focus Map. A team may implement them as semantic routes with stable URLs for deep links and recovery.

| ID | Experience | Entry | Main composition | Required outcome |
|---|---|---|---|---|
| X00 | Bootstrap / integrity | App start | Thin seal + plain setup status | Determine fixture, data availability, local integrity |
| X01 | Crew identity | First run / switch crew | Crew beacons around aperture; clear selection | Confirm active person and access scope |
| X02 | Presence | Login / return | Left signals, center Core, right body, bottom Horizon | Understand current priority and ask |
| X03 | Vital focus | Tap signal / query | Focused trace + baseline evidence | Understand deviation and quality |
| X04 | Body atlas | Tap hologram / query | 3D region + accessible Body Tree | Explore system with evidence |
| X05 | Readiness | Ask readiness / event | Decomposable score / factors / missing coverage | Explain score and limits |
| X06 | Protocol | Approved next step | One action path, prerequisites, completion | Perform/record reviewed step |
| X07 | Caution / triage | A0 rule fires | Opaque priority projection | Understand issue and decide next safe step |
| X08 | Critical / emergency | A0 urgent event | Safety Curtain, no cinematic occlusion | Follow approved emergency route |
| X09 | History | Ask “what changed?” | Timeline with causal evidence anchors | Audit events and reversals |
| X10 | Earth communication | Queue / show link | Packet Trail and latency | Review, queue, monitor, retry safely |
| X11 | Mission & environment | Mission Stamp / query | Mission strip, connectivity, DONKI feed status | See what applies locally |
| X12 | Crew & preferences | SKY Seal / Focus Map | Identity, access, voice, privacy, display profile | Configure without losing orientation |
| X13 | Diagnostics / degraded | Sensor/renderer/network fault | Flat instrument board | Continue essential work offline |

### X00 — Bootstrap and local integrity

- Show launch status and **what is actually ready**: local database, telemetry ingestion, rule engine, device permissions, report outbox, generative UI (optional).
- Never use an indefinite progress spinner. On recoverable error, show **Retry / Open diagnostics / Continue in reduced mode**.
- If the safety rule engine is not available, enter `degraded` and state that local automated assessment is unavailable; do not claim normal status.

### X01 — Crew identity (screenshot A, redesigned)

The screenshot currently uses three equal outlined rectangles and a bright teal Continue button. Preserve clarity and keyboard selection, but make the finished experience feel like **joining a particular instrument channel**:

- Full dark Canopy; center **Identity Aperture** containing the currently selected crew identity and role.
- Non-selected `CrewBeacon`s arranged as a sparse line/arc or vertically on small screens, not a marketing pricing grid.
- Each beacon shows call sign, full name, crew role, selection state, and access restrictions if any.
- A deliberate **“Enter as Ayla Reyes”** control is part of the Horizon; it is a normal high-contrast button, not a floating glass pill.
- Keyboard `1..N` selects only when no text field is active; arrows move selection; Enter confirms. Touch selection has >=48px target.
- Screen readers receive a radio-group with a clear group label and selection count.
- No auto-entry after hovering or accidental click; no hidden reset of selected person.
- Display a clear `SIMULATED CREW` stamp for demo profiles; actual crew access needs a separate authentication/authorization policy.

### X02 — Presence (screenshot B, refined)

- Top left: Sky Seal, product identity, optional small assistant readiness message.
- Top right: mission/day and link state with a real source timestamp and concise status.
- Left: four observable signals with explicit freshness; no false “stable” when the stream is incomplete.
- Center: Sky Core orb. Greeting is personalized using active session; short question or top finding appears below, never a wall of copy.
- Right: BodyVolume silhouette and reviewed status. A status like `Stable` appears only when verified coverage exists; otherwise use “Assessment incomplete.”
- Bottom: HorizonComposer, actual voice control, typed alternative, captions and minimal intent preview.
- Artwork (astronaut silhouette, Earth curvature, internal window frame) must remain quiet and **never block text**. In operator/critical modes, art fades or disappears.

### X03 — Vital focus

The selected signal moves from its left anchor to center. The trend comparison is primary, backed by coverage and evidence. A selected organ can light subtly if semantically relevant. Actions are limited to `Review evidence`, `Compare period`, `Add note`, or `Return`; there is no “AI insight” card stack.

### X04 — Body atlas

Center becomes a body chamber. Left shows system selection (compact labels, not a hidden icon-only wheel); right shows measured indicators and validity. Entering a deeper organ level must reveal whether that organ has data. Tapping a visible region without evidence returns “No direct measurement for this region,” not a generated estimate.

### X05 — Readiness

Do not show a mystical luminous percentage. The score appears as a **calibrated instrument readout**, e.g. `62 / 100`, followed by `MODEL ESTIMATE · SIMULATED`, current time and model version. A decomposition shows factors, weights, quality, and what is missing. If data coverage fails the configured minimum, show **“Not enough data to calculate readiness”** instead of a number. A readiness score does not certify fitness to land, walk, exercise or undertake EVA.

### X06 — Procedure and rehabilitation

One action per work surface. Show purpose, prerequisite safety checks, reviewed source, dose/duration if validated, who authorized, who executes, pause/stop controls, and what confirmation writes to the log. Never turn an AI suggestion directly into a “start exercise” control without reviewed rules and human agreement. Procedures are readable with effects disabled.

### X07 — Caution

The normal scene dims, leaving a matte prioritized projection. Required hierarchy: `Severity + issue -> evidence -> uncertainty -> reviewed next step -> confirm/decline/seek help`. Acknowledge a warning separately from marking the underlying problem resolved. The app may continue an unrelated task only after critical information remains persistently visible.

### X08 — Critical

Opaque, high-contrast **SafetyCurtain** occupies most of the display. It shows the verified condition, timestamp, relevant sensor quality, next safe reviewed step, and contact/escalation path. No 3D orb, animated stars, or immersive transitions in front of the alarm. Acknowledge does not mean resolved. If the engine or device cannot be trusted, explicitly state the monitoring limitation; never fabricate a reassuring verdict.

### X09 — History and evidence

A scrollable **event spine**: measurements -> rule evaluation -> agent explanation -> operator decision -> procedure event -> report event. Events carry time, actor, source, hash/revision where relevant, and the distinction between fact vs interpretation. The event spine is not a chat transcript with prose bubbles.

### X10 — Earth / delayed communications

Use a **Packet Trail** rather than a generic messages inbox. Show: drafted, waiting for approval, queued locally, eligible to transmit, sent, received/acknowledged if known, retrying, failed. Display the simulation's configured one-way delay (e.g. 20 minutes) and distinguish *estimated earliest arrival* from actual receipt. Round-trip delay is approximately 40 minutes **if** both links have 20-minute delay and no outages; never mark “delivered” at the expected time without an actual receipt/transport acknowledgement. Link outage does not stop local monitoring.

### X11 — Mission and environment

Show mission clock, spacecraft context, last known external environment feed (e.g. space weather/DONKI), update age, and whether it is relevant to the current health workflow. A stale external feed is “Last known” or “Unavailable,” never live. Mission geography and the ISS/Mars label derive from the active fixture.

### X12 — Crew and preferences

A compact, readable non-cinematic view for settings. Provide selected user, role/access, voice/captions, language, screen scale, contrast/motion profile, local data policy, privacy on shared displays, device diagnostics, and obvious switch-crew action. Safety preferences are not hidden inside an AI chat.

### X13 — Diagnostics and degraded mode

Plain text, charts, sensor states, fault codes, local time, clock drift, adapter health, last rule evaluation, database health, and outbox health. Degraded operation is an explicitly designed first-class experience, not a fallback thrown together after WebGL fails.

---

# PART VI — INTERACTION LOGIC AND STATE CONTRACTS

## 18. Global interaction model

### Input methods and parity

| Intent | Voice | Keyboard | Pointer / touch |
|---|---|---|---|
| Open Focus Map | “Show options” | `Ctrl/Cmd+K` | Select Sky Seal |
| Inspect vital | “Show heart-rate history” | Focus signal + Enter | Tap signal |
| Inspect body | “Show cardiovascular system” | Body Tree + Enter | Tap hologram/label |
| Start voice | “Start voice” not assumed hotword | Focus mic + Enter/Space | Tap mic |
| Type | Standard typing | Input focus | Text affordance |
| Close projection | “Go back” | Esc | Visible Back |
| Confirm consequential action | Voice confirmation only with explicit review policy | Focus Confirm + Enter | Tap Confirm |
| Acknowledge alert | Dedicated action | Focus Acknowledge + Enter | Tap Acknowledge |

No global keyboard shortcut fires while a text field, IME composition, screen-reader virtual cursor action, or safety dialog requires focus. Do not assign bare `Space` to start recording globally.

### Focus and interruption

- Focus follows user action, not continuous stream updates.
- A new high-priority safety event may interrupt, but not erase unsent work; it becomes resumable after the alert.
- A safety curtain may interrupt screen-reader reading order using appropriate live-region priority, with meaningful update throttling.
- User intent and input are persisted locally during recoverable rendering/network failures; do not persist raw mic audio by default.

## 19. Required interaction state machines

### 19.1 Voice

```
idle → permission_requested → listening → transcribing → interpreting
                                               ├→ answering → idle
                                               └→ proposal → awaiting_review
any → fault → typed_fallback
listening → stopped → idle
answering → interrupted → idle/listening (only on explicit action)
```

### 19.2 Data quality

```
not_connected → acquiring → valid → aging → stale
                      └────────────→ invalid
source_recovered → acquiring → valid
```

A stale reading is not overwritten by a null placeholder without preserving the last-known timestamp; but the UI must not present the stale value as current.

### 19.3 Action authorization

```
agent_draft → validation → proposal → crew_review → confirmed → committed
                                     ├→ declined
                                     └→ revised → validation ...
```

`confirmed` is tied to **exact action content, subject identity, and evidence revision**. Any relevant change invalidates approval. Commit side effects are idempotent under retries.

### 19.4 Earth report

```
draft → review → approved → queued_local → transmission_attempted
                                      ├→ delivered/acknowledged (with evidence)
                                      ├→ retryable_failure → queued_local
                                      └→ permanent_failure → manual_review
```

`queued_local` is not `sent`; `sent` is not `received`; `received` is not `read`.

## 20. Required data model (TypeScript-facing)

Design relies on strong, stable contracts. The following describes **presentation domain types**; integrate with your current Bun/TS backend types rather than duplicating canonical medical models.

```ts
type FixtureMode = "showcase" | "story" | "operational";
type Quality = "valid" | "stale" | "invalid" | "missing" | "disconnected";
type Origin = "sensor" | "manual" | "derived" | "synthetic";
type Assessment = "normal" | "watch" | "action_required" | "critical" | "unknown";
type UIMode = "daily" | "focused" | "procedure" | "caution" | "critical" | "degraded";

type MissionContext = {
  missionId: string;
  missionName: string;
  missionDay: number;
  missionTimeIso: string;
  isSimulation: boolean;
  link: { state: "connected" | "delayed" | "lost" | "unknown"; oneWayDelayMs?: number };
};

type CrewIdentity = {
  id: string;
  displayName: string;
  callSign?: string;
  role: string;
  authorizedScopes: string[];
};

type MetricReading = {
  id: string;
  crewId: string;
  metric: string;         // stable metric identifier
  value: number | null;
  unit: string;           // canonical, validated unit
  observedAt: string;     // measurement time, ISO
  receivedAt: string;     // ingestion time, ISO
  source: { origin: Origin; deviceId?: string; calibrationId?: string; version?: string };
  quality: Quality;
  simulation: boolean;
};

type EvidenceRef = {
  id: string;
  sourceType: "metric" | "rule" | "procedure" | "reference";
  sourceVersion: string;
  timestamp?: string;
};

type HealthFinding = {
  id: string;
  crewId: string;
  assessment: Assessment;
  ruleId: string;
  ruleVersion: string;
  evaluatedAt: string;
  evidence: EvidenceRef[];
  coverage: "sufficient" | "insufficient" | "unknown";
  explanation?: string;   // must not override trusted finding
};

type ActionProposal = {
  id: string;
  crewId: string;
  title: string;
  actionType: string;
  arguments: Record<string, unknown>; // validated against action-specific schema
  evidence: EvidenceRef[];
  requiredProcedureId?: string;
  requiresConfirmation: true;
  revision: number;
  expiresAt?: string;
};

type SkyScreenModel = {
  mission: MissionContext;
  crew: CrewIdentity;
  mode: UIMode;
  connectivity: "online" | "offline";
  activeFocus: string | null;
  priorityFinding?: HealthFinding;
  recentMetrics: MetricReading[];
  assistantState: "idle" | "listening" | "transcribing" | "reasoning" | "speaking" | "awaiting_confirmation" | "unavailable";
  isSimulation: boolean;
};
```

### Contract requirements

- All time values have an explicit source clock and time zone/UTC convention.
- Normalize units at ingestion; show unit on-screen.
- Separate measurement timestamp from ingestion timestamp.
- Preserve source, calibration and algorithm version where applicable.
- Do not accept frontend-submitted severity as authoritative.
- Privacy/access enforcement is server-side. Hiding data in OpenUI is not authorization.
- Distinguish null/missing from zero; never chart `null` as zero.
- The readiness model has its own validated output contract: factor, weight, score contribution, coverage, source, algorithm version, uncertainty where justified.

---

# PART VII — GENERATIVE UI RULES

## 21. OpenUI is a compositor, not a designer with unlimited authority

OpenUI may assemble preapproved surfaces and choose appropriate focus for the question. It may **not** invent colors, icons, gestures, medical categories, new data access, or arbitrary DOM execution.

### Hard boundary

```
Astronaut intent
   ↓
Intent parser (may use LLM) ───────────────→ Preview/clarification (non-executing)
   ↓ committed request
Policy / identity / data scope checks
   ↓
Data providers + deterministic assessments
   ↓
Projection planner (registry-only typed schema)
   ↓
Schema + semantic + safety validator
   ↓
Sky renderer (fixed tokens + components)
   ↓
Focused interactive projection
```

The renderer is responsible for final visual quality and accessible behavior. The model is responsible for **which approved components** to display and which permitted data references to bind. The model does not render raw JSX, HTML, executable scripts, CSS, GLSL, dynamic import paths, or server calls.

## 22. Allowed projection DSL (example)

```ts
type ProjectionNode =
  | { kind: "signal-trace"; metricId: string; range: "24h" | "7d" | "30d" }
  | { kind: "body-system"; systemId: string; selectedRegionId?: string }
  | { kind: "readiness-breakdown"; assessmentId: string }
  | { kind: "evidence-ribbon"; evidenceIds: string[] }
  | { kind: "procedure-path"; approvedProcedureId: string }
  | { kind: "packet-trail"; reportId: string }
  | { kind: "decision-slate"; proposalId: string };

type ProjectionPlan = {
  schemaVersion: "sky.projection.v1";
  intentRevision: number;
  subjectCrewId: string;
  title: string;
  focus: "center" | "body" | "work";
  nodes: ProjectionNode[]; // max 4; no recursive unrestricted layout
  evidenceIds: string[];
};
```

**Limits:** maximum one primary projection at a time; maximum four nodes in a plan; only one DecisionSlate; max one freeform explanatory paragraph before a direct action; no generated critical alert. Any unsupported component request is rejected or mapped to a safe plain-text alternative.

## 23. Generative UI quality gates

Every plan MUST pass:

1. **Schema:** known kind, allowed fields, valid IDs and ranges; deny unknown properties.
2. **Auth:** the current crew/session may read each referenced datum.
3. **Provenance:** derived/clinical findings bind verified backend evidence.
4. **Medical language:** agent explanations are labeled, uncertainty is retained; no synthetic diagnosis or threshold.
5. **Density:** too much information becomes focused evidence view, not dozens of cards.
6. **Accessibility:** every projection gets a title, semantic order, keyboard path, screen-reader description, and non-3D fallback.
7. **Responsive fit:** layout engine can place it at all supported breakpoints without clipped controls.
8. **Performance:** estimated WebGL/DOM budget; downgrade effects before dropping essential content.
9. **Side effects:** confirmations are separate and bound to revision; preview cannot execute.
10. **Visual identity:** no arbitrary theme/styles; only Sky primitives and design tokens.

### Non-conforming example

An LLM says “show 8 neon cards: organ stress 91%, radiation safe, mood happy, approve report.” Reject: unverified medical claims, unbounded layout, no provenance, and unsafe side-effect coupling.

### Conforming example

“Compare my heart rate with my baseline” produces one `signal-trace`, one `evidence-ribbon`, and optional data-quality note. The comparison source is the deterministic baseline engine, not the model's invented number.

## 24. Rendering hierarchy and implementation boundaries

Use **semantic HTML for all text and controls**, SVG for accurate charts/lines, and an optional 3D renderer for atmosphere/body. The 3D renderer is not the source of truth for focus, labels, severity, or decisions.

Suggested React hierarchy:

```tsx
<SkyAppProviders>
  <MissionSessionGate>
    <SkyCanopy />
    <SkySeal />
    <MissionStamp />
    <SignalWell />
    <PresenceAperture>
      <SkyCore />
      <CurrentPriority />
    </PresenceAperture>
    <BodyVolume />
    <ProjectionHost />
    <HorizonComposer />
    <CriticalSafetyLayer />
    <FocusMap />
    <AccessibleStatusAnnouncer />
  </MissionSessionGate>
</SkyAppProviders>
```

The above represents the **presence composition**. Identity, procedure, diagnostics, and emergency experiences may replace the main composition rather than showing all elements hidden behind one screen.

### Proposed code organization (adapt to actual repo)

```text
apps/web/src/
  app/                       # routes, providers, session shell
  sky/
    design/
      tokens.css
      typography.css
      motion.css
      primitives.css
    scene/
      SkyCanopy.tsx
      SkyCore.tsx
      BodyVolume.tsx
      BodyTree.tsx
      scene-profile.ts
    primitives/
      Aperture.tsx
      Horizon.tsx
      Tether.tsx
      Seal.tsx
      FlightStrip.tsx
    projections/
      ProjectionHost.tsx
      ProjectionRegistry.ts
      validate-projection.ts
      components/
        SignalTrace.tsx
        EvidenceRibbon.tsx
        DecisionSlate.tsx
        ReadinessBreakdown.tsx
        ProcedurePath.tsx
        PacketTrail.tsx
    experiences/
      CrewIdentity.tsx
      Presence.tsx
      VitalFocus.tsx
      BodyAtlas.tsx
      Readiness.tsx
      Protocol.tsx
      Triage.tsx
      EarthComms.tsx
      Diagnostics.tsx
    interaction/
      voice.machine.ts
      focus.machine.ts
      action.machine.ts
      useKeyboardNavigation.ts
      useAccessibleMotion.ts
    domain/
      contracts.ts
      selectors.ts
      quality.ts
      fixture-context.ts
    tests/
      accessibility.test.tsx
      visual.spec.ts
      action-safety.test.ts
      fixture-integrity.test.ts

apps/<current-bun-backend>/   # actual repo path governs; don't assume apps/server exists
  ...                        # typed providers, rule results, authorization, outbox
```

Use Bun for package scripts/testing/backend runtime according to current project conventions; prefer native TypeScript boundaries. The UI spec does not authorize a Python migration or a backend rewrite merely because old docs mention one.

---

# PART VIII — SAFETY, TRUST, ACCESSIBILITY

## 25. Alert design and trust rules

### 25.1 Alarm/attention levels

| Level | Origin | UI | Operator action |
|---|---|---|---|
| Informational | Valid sample/event | Neutral notice near origin | Optional inspect |
| Watch | Reviewed rule | Amber with text, timestamp, evidence | Review finding |
| Action required | Reviewed rule/procedure | Opaque DecisionSlate with reason | Accept/decline/escalate |
| Critical | Reviewed urgent rule | Safety Curtain, priority audio/haptic where supported | Acknowledge, follow protocol |
| Uncertain / missing | Data availability | Clear UNKNOWN/STALE status | Inspect source / restore sensing |

### 25.2 Mandatory distinctions

- **Acknowledged** ≠ resolved.
- **Confirmed** ≠ performed.
- **Queued** ≠ transmitted.
- **Transmitted** ≠ received.
- **Simulated** ≠ measured.
- **AI explanation** ≠ validated clinical finding.
- **Offline link** ≠ loss of local monitoring.
- **Normal on available sensors** ≠ all-body fitness or mission readiness.

### 25.3 Medical safety bar

- A0 alerts bypass agent generation. A model outage cannot silence them.
- Every reviewed action retains criteria, version, evidence, and crew decision.
- Contradictory data should surface uncertainty instead of smoothing into one reassuring status.
- User-facing thresholds and action doses must be linked to reviewed sources stored with the rule/procedure catalog.
- Readiness is a model output with published assumptions, **not a medical clearance**.
- This design is a prototype specification until actual safety, hardware, security, and human-factors validation is performed.

## 26. Accessibility and crew ergonomics

Aim for WCAG 2.2 AA on supported web surfaces and review NASA-STD-3001 Volume 2 crew-interface requirements during formal validation. This document is not a certification matrix.

### Concrete requirements

- Keyboard-only path to every major function, including BodyVolume.
- `focus-visible` remains bright and non-glowing enough to see on dark surfaces; do not suppress browser focus.
- Screen-reader DOM order: identity/mission -> active alert -> priority -> signals -> body summary -> Horizon -> supplementary.
- Normal text contrast target >=4.5:1; large text >=3:1; nontext essential boundaries >=3:1. Validate actual rendered colors and overlays.
- W3C AA minimum targets are 24×24 CSS px with exceptions; **Sky internal target** is >=44×44 CSS px for routine controls and **56×56 or larger** for primary glove/touch controls where practical.
- Explicit textual labels for buttons; icons alone are insufficient on critical controls.
- Do not use hover as the only reveal; touch/keyboard have equivalent discovery.
- Reduced-motion mode disables unnecessary orbit, camera drift, particle layers and mic flourish.
- High-contrast mode uses an opaque base; critical reading content must never sit on transparent Earth/background artwork.
- Captions and transcripts exist for all voice interactions, without requiring audio to understand important warnings.
- Text resize to 200% and browser zoom/reflow tested; no clipping of Confirm, Acknowledge, or Back.
- Controls usable under imperfect motor precision: generous spacing and alternatives to drag-only 3D navigation.
- Colors, audible cues and haptics are redundant, not exclusive channels.
- Localization supports English/Vietnamese and others as content assets; never concatenate translated sentence fragments mechanically.

## 27. Privacy and role boundaries

- Astronaut personal telemetry defaults to private view. On a shared display, show a **privacy-shielded summary** until explicitly unlocked.
- Role capability is server-enforced; a commander and medical officer may have different permitted details, but role names alone do not grant access.
- Local-first storage and outbox follow a clearly defined retention/encryption policy; do not embed sensitive data in analytics URLs, error reports, or generated component JSON logs.
- On switching crew, clear pending composer context, focused private readings, transcript and unapproved action proposals; do not let identity switch preserve the previous person's report.
- Microphone permission is explicit and visible. Do not record continuously or transmit raw audio by default.
- Remote model APIs must never silently receive clinical data. Require an approved integration policy, data minimization and explicit scope; offline deployment must be possible with agent features disabled or a trusted local model.

---

# PART IX — RESPONSE, PERFORMANCE AND OFFLINE

## 28. Offline-first is a visual behavior

Sky's identity is tested most honestly when Earth is unreachable.

| Dependency fails | Sky's behavior | Forbidden illusion |
|---|---|---|
| Internet / Earth link | Local evidence, rules, action log and outbox remain accessible | Fake “message delivered” |
| Generative model | Deterministic findings, charts, procedures and navigation still work | Reassuring hallucinated responses |
| WebGL/GPU | Flat Canopy, 2D body and DOM instruments | Blank home screen |
| Microphone | Typed composer, accessible controls | Pulse waveform suggesting recording |
| External space-weather feed | Last-known value with timestamp or unavailable | “Live radiation normal” |
| Wearable / sensor | Last-known data labeled stale, quality warning | Display last reading as current |
| Local rule engine | Diagnostic limitation + escalation workflow | Green “Stable” status |
| Outbox persistence | Explicit failure and recovery path | Silent send success |

### Performance targets (proposed, verify on target devices)

- Useful semantic shell appears before any WebGL initialization.
- Local navigation or focus feedback: p95 under 150ms on target laptop; do not block on network.
- DOM measurement updates do not re-render the full 3D scene.
- Motion profile: 60fps target on capable desktop; 30fps acceptable in balanced cinematic mode, with graceful downgrade; **critical screen must not depend on fps**.
- Scene assets are lazy-loaded after essential controls; stop render loops when hidden/inactive.
- Dynamic resolution/fidelity tier can downgrade bloom, 3D organ geometry, and particles, never reduce text size or hide alarms.
- Preserve state under tab suspension, low-power throttling, resume and reconnect.

### Suggested visual profiles

| Profile | Default use | Scene | Body | Motion |
|---|---|---|---|---|
| `cinematic` | Demo / kiosk on powerful machine | Earth/ship framing | L0–L3 available | Restrained, state-based |
| `operator` | Daily work | Subtle abstract Canopy | 2D/3D on demand | Mostly still |
| `conserve` | Mobile / low power | Flat mineral backdrop | 2D default | Off |
| `critical` | Safety event | Opaque high-contrast | Hidden unless necessary | Off |

---

# PART X — ENGINEERING ACCEPTANCE CONTRACT

## 29. Visual acceptance checklist

A feature is not visually complete until:

- [ ] A screenshot **without SKY wordmark** still reads as the same design language.
- [ ] At first glance, there is one obvious point of attention—not three glowing panels fighting.
- [ ] A Canopy, Aperture, Horizon or Tether exists because of meaning, not decoration.
- [ ] Resting screen contains no generic dashboard card grid or persistent left nav.
- [ ] Color matches its semantic role; no decorative red/amber medical state.
- [ ] No functional text is baked into rendered scene imagery.
- [ ] At 360px wide and 200% zoom, the primary task remains possible.
- [ ] Missing/stale/simulated data is unmistakably different from measured-current.
- [ ] Critical alert works with 3D, voice, and agent disabled.
- [ ] Voice, text and keyboard lead to the same outcome.
- [ ] Identity, greeting, mission and report subject never disagree.
- [ ] No AI-generated HTML, CSS, JavaScript or arbitrary tool call enters the renderer.
- [ ] The right body hologram has an accessible equivalent and measurement-status labels.
- [ ] The action proposal and Earth send require a review gate with exact content revision.
- [ ] Visual effects have a useful purpose and are off in reduced-motion mode.

## 30. Test matrix

| Scenario | Test assertion | Priority |
|---|---|---|
| Select Ayla fixture | Roster, greeting, telemetry subject, mission stamp agree | P0 |
| Select Minh story fixture | Hồng Hạc mission and four-person crew agree; no ISS label leak | P0 |
| Disconnect Earth | Local data works, report queued and never fake-delivered | P0 |
| Stale oxygen reading | Last timestamp visible, assessment does not falsely say stable | P0 |
| Critical event while talking | SafetyCurtain appears, speech/audio de-prioritized, safe focus moves | P0 |
| Agent fails | Alert engine + manual Focus Map + data continue | P0 |
| Renderer fails | DOM/2D view continues with keyboard control | P0 |
| Switch user during proposal | Old proposal invalidated; no cross-user data shown | P0 |
| Edit action proposal args | Confirmation token invalidated; re-review required | P0 |
| Retry report transmission | Idempotent send, no duplicate report | P0 |
| Missing metric baseline | No invented comparison; adequate explanation | P0 |
| Open body with keyboard | Can select system, region, evidence, reset without drag | P1 |
| Typed and voice commands | Equivalent intent, review, and fallback | P1 |
| Reduced motion + high contrast | All meaning preserved; no critical content obscured | P1 |
| Narrow phone at 320–390px | No horizontal overflow in controls; task achievable | P1 |
| Shared wall display | Private details masked by default | P1 |
| Multilingual strings | Controls remain readable, no truncation of critical action | P1 |
| 200% zoom | Alert, action and Back visible/reachable | P1 |
| Low-power 3D | Stable downgrade and no frozen interaction | P2 |
| Visual regression | Consistent hierarchy across 6 canonical states | P2 |

## 31. Reference-image regression strategy

Do not treat the screenshot as an invisible clickable background. Build *real independent UI components*, then compare:

1. For the **presence console** compare the reference composition: left signals, central orb/prompt, right body/status, bottom Horizon, upper mission anchors.
2. For **crew selection** compare clarity and recognizable identities, not the exact three-card boxes; the final design intentionally replaces that conventional layout.
3. Create snapshots at 1672×941 (reference concept), 1440×900, 1280×800, 1024×768, 820×1180, 390×844 and 320×700.
4. Keep separate `cinematic` and `operator` snapshots. Do not compare a rich scene to the low-motion flat fallback.
5. Add semantic screenshots for `stale`, `unknown`, `warning`, `critical`, `offline`, `agent unavailable`, and `report queued`.
6. Run automatic accessibility tests and manual keyboard/reader tests; screenshot similarity alone is not acceptance.

## 32. Implementation order (dependency-aware)

1. **Foundation:** contract alignment, fixture consistency, design tokens, typography, shell/Canopy, keyboard and focus.
2. **Identity + presence:** crew selector, MissionStamp, SignalWell, Horizon, flat SkyCore; first end-to-end demo must work without 3D.
3. **Trusted evidence:** backend telemetry selectors, quality states, baseline/difference trace, alert layer, readiness decomposition.
4. **Decisions + Earth:** action review, audit, procedure path, local outbox, delayed communication, all state transitions.
5. **Generative UI:** fixed registry, typed plan validator, safe server data bindings, intra-turn preview + blanks.
6. **3D and atmosphere:** sophisticated SkyCore shader, anatomy, ship/Earth environment, efficient motion modes.
7. **Hardening:** mobile/wearable adaptation, low-power behavior, localization, assistive tech, privacy, fault injection.

**Never** build the expensive WebGL showpiece before proving the offline safety and identity flow works with plain HTML.

## 33. Agent-coding instructions

The following is the implementation contract for agents working on the repository:

> Treat `DESIGN.md` as the design authority. Read the current `ARCHITECTURE.md`, `STORY.md`, relevant `AGENTS.md` and code before editing. Implement Sky using existing TypeScript + Bun architecture. Preserve the distinctive Canopy/Aperture/Horizon/Tether grammar. Do not add a conventional dashboard navigation/sidebar, a card grid, or arbitrary neon gradients. Render all important controls and data as accessible DOM. OpenUI composes a typed registry; it must not generate executable UI. All measurements, statuses, thresholds, and readiness scores come from trusted typed providers, not the LLM. Implement one vertical slice end-to-end, with test coverage for simulated data labels, identity consistency, offline operation, keyboard accessibility, and safety gates. Update this design document when an approved design decision changes. Do not silently fill unknowns with plausible-looking values.

## 34. Decision record / open questions

These are not blockers to authoring the design; they must be decided before operational deployment:

| Topic | Current proposed position | Decision needed |
|---|---|---|
| Story vs demo identity | Distinct named fixture configurations | Which public entry uses which fixture? |
| Clinical scope | Prototype with reviewed deterministic findings | Which clinical procedures and thresholds pass expert review? |
| Runtime | TS + Bun | Current exact package boundaries and API adapters |
| Voice | Opt-in, typed fallback | Local ASR/TTS model and security posture |
| Body mesh | Licensed 3D asset, accessible Body Tree | Source/attribution/geometry fidelity/organ coverage |
| Space art | Showpiece mode, quiet operator mode | Licensed artwork and available GPU budget |
| Authentication | Local crew identity + server authorization | Device/session/role model for production |
| Communications | Durable outbox, simulated 20-minute one-way delay | Actual transport and acknowledgement semantics |
| Readiness | Fully decomposed, coverage-gated model | Clinical validity and acceptable limitations |
| Compliance | WCAG/NASA crew-interface review inputs | Scope and method of formal review/testing |

---

## 35. Canonical design examples

### A. Calm presence

**Visual:** The room is dark. Earth is a faint, peripheral horizon rather than a wallpaper. A single pale, near-still SkyCore rests above the work Horizon. One left signal reads `62 bpm · 09:14`, another reads `Sleep data 43 min old`. The right body outline stays neutral. No banner screams for attention.

**Copy:** “Good morning, Minh. Your recovery record has one new change.”  
**Action:** “Review the change” and an explicit typed/voice path.

### B. Metric attention

**Visual:** The heart-rate signal follows a short Tether to a center Aperture. Orb fades. A quiet real trace appears with the astronaut's own baseline band. Invalid/missing data is a gap. The 3D body may indicate cardiovascular system, but nothing flashes red by association.

**Copy:** “Resting heart rate increased compared with your usual range. Based on 6 valid readings.”  
**Action:** “Review evidence” and “Return.”

### C. Review an action

**Visual:** Cinematic backdrop dims. One angular matte DecisionSlate on the Horizon shows a reviewed action, its basis, and what a confirmation does. Human-readable buttons have ample space.

**Copy:** “Review the proposed lower-intensity session. This is not started yet.”  
**Action:** “Confirm plan” / “Decline” / “See basis.”

### D. Safety event

**Visual:** No orb, no holo effect. Opaque, high-contrast SafetyCurtain; one condition and timestamp; safety instructions prioritized; data quality explicit. The background is irrelevant.

**Copy:** “CRITICAL — [verified rule outcome]. Recorded at 09:14 UTC. Follow [reviewed protocol].”  
**Action:** “Open protocol” / “Acknowledge alert” / “Request assistance,” according to validated policy.

### E. Earth link unavailable

**Visual:** The mission Stamp reads `EARTH LINK LOST`. Packet Trail displays one `QUEUED LOCALLY` item with created time, approved by, and retry state. Sky remains calm.

**Copy:** “Report saved on board. It has not been sent.”  
**Action:** “Review queue” / “Retry when available.”

---

## 36. External references and boundaries

Use these as **design and human-factors references**, not as a claim that Sky is certified or endorsed:

- NASA Space Apps 2026, *Create Health Monitoring Software for Astronauts on Space Missions*: https://www.spaceappschallenge.org/2026/challenges/health-monitoring-software/
- NASA-STD-3001 Volume 2 (current official NASA standard overview): https://www.nasa.gov/reference/nasa-std-3001v2/
- NASA-STD-3001 Volume 2, crew-interface consistency and displays (official NASA sections): https://www.nasa.gov/reference/appendix-f-vol-2/
- W3C Web Content Accessibility Guidelines 2.2: https://www.w3.org/TR/WCAG22/
- W3C Understanding Target Size (Minimum): https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum

---

## Final design principle

**Sky should look unusual because it behaves differently, not because it uses strange shapes.**

The highest expression of this design is the moment when the astronaut is tired, the Earth link is down, and the AI is unavailable—and Sky still clearly shows *what is known, what is uncertain, what needs attention, and what the astronaut can safely do next*.
