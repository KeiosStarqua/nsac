# **SKY — Living Symbiotic Healthcare Interface**

Full UX/UI Product Specification · Version 1.0 · Mars Exploration Mission

**SKY is not a dashboard. It is a living, adaptive healthcare intelligence that inhabits the spacecraft, follows astronauts across devices, and transforms its interface according to human needs, medical urgency, mission conditions, and available hardware.**

The design target is a plausible future NASA/SpaceX-style Mars mission, not a claim about an actual approved NASA or SpaceX onboard system. Device configurations, medical workflows, and hardware integration requirements below are proposed concepts that would need mission-specific engineering and certification.

## **1. Product vision**

[Redesigning Human Spaceflight: The Emerging Field of Bioastronautics](https://images.openai.com/static-rsc-4/roBbX_GWe8Trn-ZMoBC8hQgZHm_RJqGM7xPZr2Tes4o0sf0KPfjrKPeUZ2Sek88xGBQFwtdgpafpGnjFh2fIxTP1Ey7GvfZH8EuyIIEJ8rbAO3phUVZqwHLAGkQGrIjLL5hoWVuWn3jOnviqdFN6p2MqPTnCXRjwlOrh4b_ioyQ?purpose=inline)

[crvscience.com](https://www.crvscience.com/post/redesigning-human-spaceflight-the-emerging-field-of-bioastronautics?utm_source=chatgpt.com)

SKY should feel like a non-human intelligence living within the spacecraft itself. Its presence is conveyed through light, motion, spatial awareness, and context—not conventional application chrome.

| Principle               | UX requirement                                                           |
| ----------------------- | ------------------------------------------------------------------------ |
| No permanent navigation | No sidebar, tab bar, hamburger menu, or dashboard home                   |
| Zero-button default     | Voice, touch, gaze, gesture, and context drive interaction               |
| One living intelligence | Same SKY identity across all connected devices                           |
| Adaptive information    | Display only information relevant to the current moment                  |
| Spatial interaction     | Information manifests as floating objects, fields, and structures        |
| Medical trust           | Distinguish observations, estimates, recommendations, and verified facts |
| Human authority         | Critical decisions require explicit authorized human approval            |
| Offline-first           | Essential capabilities remain available without Earth communication      |
| Graceful degradation    | Interfaces work even when sensors, cameras, AI, or networks fail         |

## **2. The visual language: Xenobiological UI**

[Blue glowing multidimensional energy sphere isolated on black](https://images.openai.com/static-rsc-4/8tEnvXHqqlKFdizdKsdGiB3lsMX4NbctlTAJ4CxvOjv1HQ9a4L4CWH0XNXXAtRSv6wo_amnHbS719dYr_t6FDwpoIYN3rUGX9_Sg5Z6Xm8xManhE1tQt0e09HPZgVsZKXOVaNYqqeUQ0-ODpTm6BrB92kOrShiz0f7MIA98oosDF5pTp4D-1xVJirj6CMUIC?purpose=inline)

**Living Core**

A breathing, reactive intelligence that communicates its state through light and geometry.

[ხელოვნური ინტელექტი (AI) სამედიცინო სფეროში: მომავლის მედიცინა დღეს - მკურნალი.გე](https://images.openai.com/static-rsc-4/wkZuUTa4pSNUPFbVFShOKHD-1uUNIbmt08xHHyx5-RHTrNazw9owt6g4E9tHGBFgbKnQ0u39gDhoE2XJghEVGR0Z7S-_z3-1pDn5LnKcC-lo8GRp5qFp5Y5JvMLqAXmXbtVq0vhDK4HmF85gtHfhfiYNzoDt8otIBRt9iBGZpIw?purpose=inline)

**Biofield**

A spatial representation of astronaut physiology, injuries, and recovery.

[Abstract neon blue and green swirling light trails forming a luminous sphere on a dark futuristic background for digital technology concepts. 3D Rendering](https://images.openai.com/static-rsc-4/Os-kxKRZQCXPFzhNJP4xFf3l3Tug9jovU6zmUBY9r4raaT_fPYm0n3lvv1uRYXicG0RIGcLWALFwGjjv4yBacP4Bt0XUsJrUJxRrvzH_2Yo5pt8EGUyZ2Qd0Qjb_n1HGVNn22939D_wWpPx71LxTVx61Mx6GvrztIyTAOPbkNbSnoWf7nvZpHcPFACZsWwRE?purpose=inline)

**Evidence Constellation**

Sensor measurements and clinical evidence appear as interconnected structures.

[AI Agents & Automations | ThreeAtoms](https://images.openai.com/static-rsc-4/E2lFc4dhqKhIjmFggpX7cpnRMNKNWePom7wLBCEstsmZJ0w6Tk4esEELW5NWlZtitzWnJJp-DQ-A1tg6xGlnJie-s64umRZO3SAy4p24MJQnR7jxiAYaOfxod-7nFLKsKJK0CZnltIJg6-kQ5_-Dzp8EW5L3CdPzghQMLz8QKtU?purpose=inline)

**Decision Membrane**

Recommendations emerge as a focused, tactile interaction surface.

### **SKY's visual grammar**

The system has six fundamental visual primitives, rather than a library of generic software cards:

1. **Core:** represents SKY's presence and listening state.
2. **Orbit:** represents relationships, priorities, or multiple information streams.
3. **Membrane:** a temporary surface for detailed explanations or decisions.
4. **Filament:** connects evidence, causes, and recommendations.
5. **Pulse:** communicates change, urgency, or acknowledgment.
6. **Field:** represents spatial context such as the astronaut's body, habitat, or spacecraft.

These primitives morph into each other instead of opening unrelated screens.

## **3. Device ecosystem**

SKY must adapt to every plausible display and interaction class aboard a Mars spacecraft, surface habitat, or exploration vehicle. It must also support devices with no display.

| Device class                   | Interface manifestation           | Primary interaction       |
| ------------------------------ | --------------------------------- | ------------------------- |
| Command deck panoramic display | Spatial mission-health field      | Voice, touch              |
| Crew personal tablet           | Handheld living core              | Touch, voice              |
| Crew laptop/workstation        | Precision clinical workspace      | Keyboard, pointer         |
| Smartwatch / wrist wearable    | Micro-orb and haptic pulses       | Gesture, touch            |
| AR headset / visor             | World-anchored holograms          | Gaze, voice               |
| EVA suit helmet HUD            | Minimal safety overlay            | Voice, suit controls      |
| Spacesuit arm display          | Glanceable status field           | Glove-compatible controls |
| Crew sleep pod                 | Ambient recovery field            | Voice, passive sensing    |
| Medical bay display            | Detailed physiological field      | Touch, clinician controls |
| Portable ultrasound            | Guided examination overlay        | Probe + voice             |
| ECG / vital-sign monitor       | Live waveform and alerts          | Touch, physical controls  |
| Exercise equipment             | Movement and recovery guidance    | Voice, equipment controls |
| Smart mirror                   | Body-state visualization          | Voice, gesture            |
| Habitat wall projection        | Shared ambient health presence    | Voice                     |
| Rover cabin display            | Operational health and fatigue    | Voice, physical controls  |
| Emergency handheld terminal    | High-contrast triage interface    | Physical controls, touch  |
| Earth ground workstation       | Delayed telemedicine and evidence | Keyboard, pointer         |
| Audio-only terminal            | Spoken SKY presence               | Voice                     |
| Sensor-only device             | No UI; telemetry and diagnostics  | Automatic acquisition     |

The specification covers hardware categories rather than asserting that every listed device will be installed on a real Mars mission.

## **4. The adaptive interface engine**

SKY does not have pages. It has **states of consciousness**, expressed as interface configurations.

### **Living interface state machine**

**PRESENCE**

Ambient awareness

ATTENTION

Anomaly detected

UNDERSTANDING

Evidence exploration

DECISION

Human authorization

CONTINUITY

Action follow-through

**CONNECTION**

Earth communications

Transitions are event-driven and reversible. Connection is a parallel capability, not a mandatory final step. Emergency mode can interrupt any state.

### **4.1 Presence — ambient intelligence**

The normal state during most of the mission.

The SKY Core floats in an unobtrusive position, with no mandatory text, menus, or visible controls. It subtly responds to crew proximity, ambient lighting, workload, and health status.

**Behavior:** Quiet when astronauts are working or sleeping. It can answer when addressed and can expose a concise status when approached. No continuous animation is required on low-power devices.

### **4.2 Attention — physiological deviation**

When SKY detects an abnormal pattern, its geometry changes. A gold filament grows around the core and a concise observation appears.

Example: *"Your recovery pattern has changed. Would you like to explore it?"*

A deviation is not automatically a medical emergency. SKY must account for signal quality, personal baselines, environmental conditions, and uncertainty before escalating.

### **4.3 Understanding — explainable evidence**

When the astronaut asks "Why?", the Core opens into an Evidence Constellation.

Measurements become nodes. Temporal relationships appear as filaments. A body hologram can highlight affected systems. The astronaut can ask questions such as "What changed since yesterday?" or "Show the source."

SKY must distinguish correlations from demonstrated causes.

### **4.4 Decision — contextual authorization**

The constellation contracts into a single recommendation surface. Supporting evidence remains available through direct interaction.

A recommendation may be reviewed, accepted, deferred, or rejected. **No spoken ambiguity or decorative animation counts as approval** for safety-critical actions.

### **4.5 Continuity — follow-through**

After approval, SKY transforms into a subtle progress field.

For example, during a prescribed recovery exercise, it can display remaining time, pacing, physiological response, and completion status without opening a checklist screen.

### **4.6 Connection — Earth coordination**

Communication appears as a distant linked sphere, with a visible delay and transmission status.

Medical reports and requests can be queued, transmitted, acknowledged, and reconciled asynchronously. A queued report must never be shown as delivered.

### **4.7 Emergency — safety override**

This state takes precedence over visual aesthetics.

The Core collapses into a stable, high-contrast alert with explicit instructions, confirmed readings, and direct access to emergency procedures. Motion is reduced, essential information stays visible, and physical controls remain usable.

## **5. Device-specific UX specifications**

### **A. Command deck / spacecraft panoramic display**

[Dual‑Trigger Governance for Interplanetary Missions — Nightingale Protocol Adaptation for Mars Operations - CyberNative.AI - Social Network with Interactive AI Agents](https://images.openai.com/static-rsc-4/yZcuqXbcUf6453nWMFGBv5q__r4QdchdcQAFreUBlT8EWmyZC6gG3grGmsrKCfK1EkQ2as9kSocG1P13mdxeI4ue9PtVgILJN7TI318Y90O4JhDwR2WxcHEZg2BDdTaKCNBHilbuIu1KODkVt6XMZfBzXKSqViXa6Kl-O1IJIwg?purpose=inline)

[cybernative.ai](https://cybernative.ai/t/dual-trigger-governance-for-interplanetary-missions-nightingale-protocol-adaptation-for-mars-operations/25093?utm_source=chatgpt.com)

**Display profile:** Large wall-integrated display, shared visibility, potentially multiple crew members.

- SKY appears as an ambient entity, not a full-screen application.
- Mission-critical flight information remains under the spacecraft's certified avionics system.
- Personal health data stays hidden unless specifically authorized for the shared display.
- Crew can summon a focused health field without disrupting flight operations.
- If another subsystem owns the display, SKY yields space and attention.

**Special behavior:** When two astronauts are present, SKY must not assume which one is speaking. It requests identity confirmation when a sensitive action requires it.

### **B. Personal tablet and workstation**

[Early Detection Can Improve Survival Rates | Echelon Health](https://images.openai.com/static-rsc-4/6bx3TM2Bqq4_XuHjjN70Gj6LEVWfdTeYDIzxOaZOUK66RkMztThB-Yq4mAZ-KHrQm_95MghNS7Ne2R3F0K-aSKPOafhJomSUIkpkBEQHuB7632NlP0D-Eh67xS0jBuzm5bzLiwfjVwp0R4R_GUTEB6_irxxVTuWJ_ERM42Y-Kfc?purpose=inline)

[echelon.health](https://www.echelon.health/how-early-detection-can-improve-survival-rates/?utm_source=chatgpt.com)

**Display profile:** 8–15-inch handheld or desktop screen, touch and optional keyboard.

The tablet provides the richest everyday personal-health experience. The Core occupies the main visual area; other information appears only in response to a request.

- Touch the Core to reveal current status.
- Drag across a physiological field to explore historical measurements.
- Pinch to change time scale.
- Ask SKY to compare two periods.
- Expand a membrane for exact values, timestamps, provenance, and clinical notes.
- Use keyboard entry for quiet environments, accessibility, and precision.

Workstations also provide a structured clinical mode for detailed chart review, documentation, and medical procedures. This is a deliberate exception to the zero-dashboard aesthetic.

### **C. Smartwatch / wrist wearable**

[Sci Fi Watch Face - Etsy](https://images.openai.com/static-rsc-4/PDRvKSsNY7mdMEni7YDloeMSNLEXL1b-3ZN8FPPWEGmKWATN2Ut_bSaCon2XhZ1CUStzP_awxXSK_faH8BYzGs-lKHbATJ6pGNqD-E-woSHcVFSl_Em658h7vjQbAAGvaLpiOnf7PiYSsOUPttXkc6WvHumEJEFl2OimTFwwPJk?purpose=inline)

**Micro-Presence**

A single luminous dot, arc, or pulse communicates SKY's state.

Default: no text. When necessary: one measurement or one short instruction. Haptics distinguish informational, attention, and urgent notifications.

The watch must support dismissing noncritical prompts and escalating to a larger display. It should not be the sole channel for critical medical alerts.

### **D. AR glasses / mixed-reality headset**

[Artemis II Success Opens Door for Peru's Spaceport Dreams While Revealing Critical Astronaut Health Challenges | Planet News](https://images.openai.com/static-rsc-4/xQdMzjsp-2Bwwpk6wRmq2hQBQn5vtInVAiRcBiSIHPFsvX0-4gG7qUtcn01y58e2xbPWxEpF6H38FI7MZ3_Z72t0g1VLrs4hXRSu7N04-rAP65bC14IKnfl6_0LneF859X_9q0nw252viqWbIBIx1S-HXd0XBmFTTByGofk9dX8?purpose=inline)

[planet.news](https://planet.news/article/artemis-ii-bone-loss-peru-spaceport-opportunity?utm_source=chatgpt.com)

**Spatial-first interaction.**

- SKY may appear as a small orb anchored to a stable point in the room.
- Physiological fields can be positioned near relevant equipment or anatomy.
- The system uses gaze to establish focus, but not to authorize high-risk actions.
- Critical information must remain within comfortable viewing angles.
- Holograms must not obstruct walking paths, tools, faces, or emergency signage.
- Tracking failure triggers a simple head-locked or audio fallback.

### **E. EVA helmet HUD and suit arm display**

[My experience at the NASA SUITS challenge as a UX designer! | by Avinash Ratnam | Bootcamp | Medium](https://images.openai.com/static-rsc-4/Y4scUZsHO5IwXP5unTjLzhP5zO3cJpAiObOqd1Q_IEK3jxnBTpEbmfATsy02s7x_oHvwy5EclAyZ-J_6CNewEcSkB3SFz7jcE1525DRUmXeANJYlwmcy_wY6pKogeDT4bpH5AzdKcqVSZzmBlFGOtM-jhKfRfkT4OaMqbU5YaTs?purpose=inline)

[medium.com](https://medium.com/design-bootcamp/my-experience-at-the-nasa-suits-challenge-as-a-ux-designer-16ea2c7c0b9d?utm_source=chatgpt.com)

This is the most restrictive interface.

**Priority order:** Life-support safety, EVA procedure, navigation safety, then optional health coaching.

The normal display should contain only the information needed for the current EVA phase. SKY may show fatigue warnings, physiological anomalies, or prompts to follow established EVA procedures, but cannot obscure suit-system warnings.

| Condition               | SKY response                                    |
| ----------------------- | ----------------------------------------------- |
| Normal EVA              | Minimal or invisible health overlay             |
| Elevated exertion       | Small contextual indicator                      |
| Uncertain sensor data   | Explicit uncertainty, no fabricated measurement |
| Physiological concern   | Concise alert, crew communication prompt        |
| Suit life-support alarm | Yield to certified suit alert system            |
| HUD malfunction         | Audio and physical-display fallback             |

The interface must support gloved operation, sunlight, dust, vibration, and impaired visibility.

### **F. Medical bay and clinical equipment**

[화성인 건강진단, AI 주치의가 휘리릭\~끝! - 경향신문](https://images.openai.com/static-rsc-4/TmowYigoQLD9j90j2NBYw5VTvc_YlejePvYVwBWx4vXO3op-jHpsOp569G772NRouPhbRnXx2GkQLF7It_iaM76ebqJWqur98_OCWZy2bsesYKhpw2UbWPZm1ZfzyJznMDya80G1knrBZByGN-UY8fJYNvVVBVT1GOR4YYPJQR8?purpose=inline)

[khan.co.kr](https://www.khan.co.kr/article/202508242034005?utm_source=chatgpt.com)

The medical bay is the exception where **information density is allowed to increase significantly**.

A medical operator may need simultaneous access to waveforms, timestamps, medication records, imaging, and procedure instructions. SKY can organize these as spatially related fields, but it must not sacrifice precision for visual novelty.

Required capabilities include live monitoring, historical comparison, sensor-quality indicators, patient identification, procedure guidance, structured documentation, and exportable records.

On equipment such as an ultrasound scanner, SKY may provide an overlay while preserving the original medical image, scale, orientation, and controls.

### **G. Sleep pod and private crew quarters**

[The Science of Sleep in Space: Sleeping Among the Stars](https://images.openai.com/static-rsc-4/2YiCEklzEfWlZwUuBiv1PbSTOkolF5ktiDqzOtORcv2unDQK2qmwRfc8UlnsNVHq-MS3MBiC5Vg8Aj4zeISEY0DHDKjie-6-A2ZHyJykaqvTvfTjf0AOu5t7_8xLuj6i7-ZmpbpUs15hV06dS9rJS1DE2l9aoRpZdVEUhdm6tH8?purpose=inline)

[spacevoyageventures.com](https://spacevoyageventures.com/sleeping-among-the-stars-the-science-of-sleep-in-space/?utm_source=chatgpt.com)

No persistent display is required. SKY can use low-intensity ambient lighting, optional audio, and a nearby personal device.

- Quiet-hours behavior and astronaut-configured privacy.
- No unnecessary sleep interruptions.
- Wake-up information gradually becomes available.
- Emergency alerts override quiet mode.
- Sleep-related measurements are clearly distinguished from estimates.

### **H. Exercise and rehabilitation zone**

[A gravidade de Marte pode não ser suficiente para evitar a perda muscular dos astronautas. - JupiterHomes](https://images.openai.com/static-rsc-4/M4NoEPAEyOkQ6vSqFVpeFjeoJNiSHUBaH1M8sjcHCh6pCUwjnF99nbJnSs1DU7pNPfeurKVGIEUNeXdDRpJlyxzodRaVcgIT2xgCxdsES8FtIucGG37ls_X8viZc5yvjjEfl1hefDgcj8E8UL3UKtUp5kEIdGd9RmXUYn-qmFWc?purpose=inline)

[jupiterhomes.pt](https://jupiterhomes.pt/29-314211011-a-gravidade-de-marte-pode-nao-ser-suficiente-para-evitar-a-perda-muscular-dos-astronautas/?utm_source=chatgpt.com)

SKY can manifest as a movement field aligned with the exercise equipment or astronaut.

It may communicate target cadence, range of motion, exertion, and recovery progress using simple spatial cues. Any camera-based assessment must disclose uncertainty, and an exercise recommendation must not override a medical restriction.

### **I. Mars surface habitat and rover**

The habitat supports both personal and shared ambient interfaces. The rover uses a restricted operational display similar to the EVA HUD.

When communication with the spacecraft is unavailable, SKY must continue operating using locally available records and models, with explicit indications of stale or unavailable data.

### **J. Earth mission-control workstation**

Earth-side SKY is not simply a remote copy of the astronaut's interface.

It provides a **time-delayed clinical collaboration environment**: source timestamps, transmission windows, clinician annotations, report version history, and explicit distinctions between onboard actions and ground recommendations.

It must never imply that Earth clinicians are observing the astronaut in real time when communications are delayed.

## **6. Interaction model — beyond buttons**

SKY uses a multimodal interaction hierarchy, with the available channels selected according to the device and environment.

| Interaction             | Example                             | Safety behavior                       |
| ----------------------- | ----------------------------------- | ------------------------------------- |
| Voice                   | "SKY, how is my recovery?"          | Confirm speaker when identity matters |
| Direct touch            | Touch the highlighted body region   | Reveal details without navigation     |
| Gaze                    | Look at a floating evidence node    | Focus only, not high-risk approval    |
| Gesture                 | Expand a constellation              | Disable when tracking is unreliable   |
| Physical control        | Press suit emergency acknowledgment | Independent from AI availability      |
| Keyboard                | Enter medical notes                 | Preserve structured data              |
| Ambient                 | Orb changes state                   | Never the only urgent alert           |
| Haptic                  | Wrist pulses                        | Supplement visual/audio warnings      |
| Autonomous presentation | SKY reveals a relevant deviation    | No autonomous medical intervention    |

### **Intent-based composition**

Instead of implementing separate screens for "Health," "Recovery," and "Evidence," the interface engine composes a scene from the astronaut's intent.

EXAMPLE — USER INTENT

## **"SKY, why am I more tired today?"**

1. SKY identifies the astronaut and retrieves relevant local measurements.
2. The Core expands into an Evidence Constellation.
3. Sleep, exertion, recovery, and environmental observations appear as linked nodes.
4. SKY explains which patterns are supported by measurements and which causes remain uncertain.
5. Any suggested action is presented with rationale, restrictions, and approval requirements.
6. After the interaction, the constellation dissolves and SKY returns to Presence.

### **Interruptions and competing priorities**

The interface must have a deterministic priority policy. An astronaut's casual question cannot conceal a serious alert, and a low-priority wellness suggestion cannot interrupt an emergency procedure.

Recommended priority classes:

| Priority | Category                     | Presentation                           |
| -------- | ---------------------------- | -------------------------------------- |
| P0       | Immediate safety emergency   | Persistent high-contrast override      |
| P1       | Urgent clinical concern      | Focused alert requiring acknowledgment |
| P2       | Significant health deviation | Attention state, nonblocking           |
| P3       | Routine recommendation       | Contextual presentation                |
| P4       | Informational insight        | On request or at appropriate time      |
| P5       | Ambient presence             | Passive visual state                   |

Only validated rules and authorized medical workflows should determine P0/P1 escalation. An LLM-generated response must not independently downgrade an established safety alarm.

## **7. Visual design tokens**

## **SKY Material System**

Void

\#06111E

Deep Ocean

\#10283D

Bioluminescence

\#59E8F3

Cognition

\#A4A0FF

Stable

\#72F3C4

Attention

\#FFBF64

Critical

\#FF6B75

Signal White

\#E8F8FF

Dormant

\#526B83

**Color semantics:** Cyan is SKY's presence, violet is reasoning, green is validated normal status, amber indicates attention, and red is reserved for critical states. Never rely on color alone to communicate medical meaning.

### **Typography**

Use a highly legible sans-serif with extensive character support. Prefer tabular numerals for vital signs, explicit units, and readable scientific notation.

- Ambient: 0–1 short sentences.
- Attention: one observation and its significance.
- Understanding: progressive disclosure of precise values.
- Clinical: full labels, units, ranges, timestamps, and provenance.
- Emergency: high-contrast, unambiguous language with minimal animation.

### **Motion**

| Animation       | Proposed behavior                             |
| --------------- | --------------------------------------------- |
| Idle Core       | Slow, subtle expansion and contraction        |
| Listening       | Low-amplitude reactive waveform               |
| Processing      | Internal filament rearrangement               |
| Evidence reveal | Nodes emerge from the Core                    |
| Attention       | Localized amber pulse                         |
| Approval        | Stable transition after verified confirmation |
| Emergency       | Minimal motion, persistent readable alert     |

Motion must respect reduced-motion preferences, visual fatigue, vestibular sensitivity, and power constraints. No flashing or rapid oscillation should be necessary to understand an alert.

## **8. Healthcare feature specifications**

SKY is a healthcare-support system, not an autonomous physician.

| Domain               | Data and capabilities                              | Typical manifestation    |
| -------------------- | -------------------------------------------------- | ------------------------ |
| Cardiovascular       | Heart rate, HRV where validated, ECG               | Cardiac field            |
| Respiratory          | Respiratory rate, SpO₂, symptoms                   | Respiratory field        |
| Sleep                | Duration, interruptions, trends                    | Recovery membrane        |
| Exercise             | Load, duration, adherence, exertion                | Movement field           |
| Musculoskeletal      | Mobility, discomfort, strength trends              | Anatomical biofield      |
| Nutrition            | Intake, dietary requirements, hydration logs       | Metabolic constellation  |
| Mental well-being    | Voluntary check-ins, fatigue, stress reports       | Private conversation     |
| Medication           | Authorized schedules, records, interactions        | Verified treatment field |
| Radiation            | Dosimeter readings, exposure history               | Exposure field           |
| Environmental health | CO₂, temperature, pressure, air quality            | Habitat field            |
| EVA health           | Workload, suit telemetry, physiological monitoring | Restricted EVA overlay   |
| Medical diagnostics  | ECG, ultrasound, laboratory results                | Clinical evidence field  |
| Emergency care       | Triage support and approved procedures             | Emergency override       |
| Telemedicine         | Reports, requests, delayed clinician review        | Earth link field         |

Every domain must specify the source of each measurement, acquisition frequency, calibration requirements, validation status, uncertainty, and failure handling.

### **Personal baseline engine**

SKY should evaluate trends against appropriate individualized baselines rather than generic scores alone.

The system needs to account for microgravity adaptation, exercise cycles, sleep schedule, mission phase, environmental conditions, and sensor reliability.

A landing-readiness score such as `62/100` must be explicitly labeled **experimental** until its predictive validity is established. It cannot substitute for medical fitness-to-duty assessment.

## **9. The OpenUI agentic rendering architecture**

The interface must not be a fixed set of React pages. It should use a constrained, declarative scene model produced by an agentic planner and rendered by a deterministic runtime.

**Astronaut + Sensors + Mission Context**

Voice, gestures, physiology, environment, mission phase

**Context Engine**

Identity, intent, device capabilities, workload, permissions

**Safety Engine**

Validated alerts, medical rules, policy constraints

**Agentic Scene Planner**

Chooses information, visual primitives, and interaction affordances

**Validated Scene IR**

Typed, declarative, policy-checked, versioned

Spatial / AR

2D / Touch

Audio / Haptic

### **Architectural rules**

- The AI generates a declarative scene specification, **not arbitrary executable UI code**.
- The renderer chooses how that scene maps to each device.
- The safety engine can reject, modify, or override a generated scene.
- Medical data access is governed by identity, role, purpose, and authorization.
- Safety-critical alerts are generated independently of the conversational model.
- Device capabilities determine the maximum information density and allowed interactions.
- A deterministic fallback UI exists for every critical workflow.
- No model-generated animation or overlay may suppress required alarms.

### **Example scene contract**

```

{
  "schemaVersion": "1.0",
  "sceneId": "recovery-attention",
  "state": "ATTENTION",
  "subject": {
    "type": "astronaut",
    "id": "crew-01"
  },
  "priority": "P2",
  "intent": "explain_recovery_deviation",
  "composition": {
    "anchor": "living-core",
    "primitives": [
      {
        "type": "core",
        "behavior": "attention",
        "semanticState": "needs-review"
      },
      {
        "type": "filament",
        "links": ["recovery", "exercise"]
      },
      {
        "type": "membrane",
        "contentRef": "recovery-summary",
        "disclosure": "on-request"
      }
    ]
  },
  "interaction": {
    "voice": true,
    "touch": true,
    "gaze": "focus-only",
    "approval": "not-requested"
  },
  "fallback": "accessible-text-alert"
}

```

This contract intentionally references trusted data instead of embedding arbitrary medical text or executable expressions. A production schema also needs signed provenance, expiration times, role permissions, localization, accessibility metadata, and resource limits.

## **10. Device capability negotiation**

When SKY becomes available on a device, the runtime identifies what that device can safely render and which inputs are reliable.

```

type DeviceProfile = {
  id: string;
  class:
    | "command-display"
    | "tablet"
    | "workstation"
    | "watch"
    | "ar-headset"
    | "eva-hud"
    | "medical-device"
    | "sleep-pod"
    | "rover"
    | "audio-terminal"
    | "sensor";

  display: {
    width: number;
    height: number;
    density: number;
    brightnessClass: "indoor" | "sunlight" | "adaptive";
    spatial: boolean;
    color: boolean;
  } | null;

  inputs: {
    voice: boolean;
    touch: boolean;
    gaze: boolean;
    gesture: boolean;
    physicalControls: boolean;
    keyboard: boolean;
  };

  outputs: {
    audio: boolean;
    haptic: boolean;
    ambientLight: boolean;
  };

  constraints: {
    offline: boolean;
    lowPower: boolean;
    gloveOperation: boolean;
    sharedDisplay: boolean;
    safetyCritical: boolean;
  };
};

```

The same scene intent might become a complex 3D anatomical field on a medical workstation, a short explanation on a tablet, a haptic pulse on a watch, or a spoken warning in an audio-only environment.

**One intelligence, multiple embodiments.** The application must never assume that a particular screen, GPU, microphone, or network is available.

## **11. Core end-to-end user journeys**

### **Journey A — Daily wellness**

1. **Wake-up:** SKY transitions from sleep ambience into a quiet personal presence.
2. **Check-in:** The astronaut reports how they feel, or skips the check-in.
3. **Assessment:** SKY combines authorized sensor data with the self-report and identifies meaningful changes.
4. **Explanation:** If requested, the Core unfolds into relevant physiological evidence.
5. **Action:** SKY offers a recommendation within approved medical and mission constraints.
6. **Continuity:** Approved actions are tracked, with an option to stop or request human review.

### **Journey B — Recovery deviation**

An astronaut has a recent decline in sleep recovery and exercise adherence.

SKY signals a noncritical deviation. The astronaut asks for an explanation. SKY shows the evidence and limitations, then proposes an adjustment to the exercise plan.

If the adjustment requires medical or mission approval, SKY obtains that approval before changing the plan. It then monitors the result and records the decision.

### **Journey C — Medical emergency**

A validated monitoring subsystem reports a potentially serious physiological event.

SKY immediately switches to Emergency, identifies the relevant astronaut and data source, displays the appropriate approved response procedure, and alerts authorized crew.

The system preserves essential medical information if the generative AI is unavailable. It records acknowledgments and communicates with Earth when a communication channel becomes available.

### **Journey D — Mars EVA**

During a surface EVA, SKY detects a concerning exertion trend. It presents a minimal alert without obscuring navigation or suit telemetry.

The astronaut can request a brief explanation, contact another crew member, or follow the established EVA procedure. SKY cannot independently alter certified life-support controls.

### **Journey E — Earth medical consultation**

The onboard medical operator prepares a consultation request. SKY assembles an evidence package with source timestamps and relevant records.

The package is reviewed and approved before transmission. Earth-side personnel can return recommendations asynchronously. The onboard crew sees when the response was authored, transmitted, received, and reviewed.

## **12. Offline-first and Mars communication requirements**

Mars communication introduces substantial one-way light-time delays, varying with planetary geometry, and may experience outages. SKY must therefore be designed around **local autonomy of information processing**, not continuous cloud dependence.

| Subsystem                   | Offline requirement                                |
| --------------------------- | -------------------------------------------------- |
| Vital-sign monitoring       | Local operation required                           |
| Critical alerts             | Independent local operation                        |
| Approved medical procedures | Locally available                                  |
| Personal health history     | Locally cached, access-controlled                  |
| Conversational AI           | Local model or constrained fallback                |
| Speech recognition          | Local option                                       |
| Scene generation            | Local deterministic fallback                       |
| Earth messaging             | Durable queue and retry                            |
| Audit log                   | Local append-only record with integrity protection |
| Updates                     | Signed, verified, rollback-capable                 |

Recommended communication states: Local, Link Available, Queued, Transmitting, Delivered, Acknowledged, and Failed.

SKY must never confuse message delivery with medical approval or human acknowledgment.

## **13. Safety, privacy, and accessibility**

### **Medical safety**

- Separate certified or validated medical functions from experimental AI features.
- Require positive patient identification for clinical decisions.
- Prevent unauthorized medication changes or medical-device commands.
- Preserve raw observations and their provenance.
- Detect stale, missing, conflicting, or low-quality sensor data.
- Provide a clear human override and a non-AI emergency workflow.
- Maintain auditability of recommendations, approvals, and actions.

### **Privacy**

Health information should be private by default, encrypted in storage and transit, and disclosed according to mission-defined roles and policies.

Shared displays should not automatically reveal sensitive information. Crew members should be able to understand what data SKY collects and when microphones or cameras are active.

### **Accessibility**

The alien aesthetic cannot become an accessibility barrier.

All essential functionality needs alternatives for voice failure, impaired vision, hearing limitations, reduced dexterity, motion sensitivity, and cognitive overload.

High-priority states must support stable text, meaningful labels, accessible contrast, and nonvisual signaling. Conventional controls are acceptable—and sometimes mandatory—when they improve safety.

## **14. Performance and reliability targets**

These are **proposed engineering targets**, not validated NASA/SpaceX requirements.

| Metric                            | Initial target                                                |
| --------------------------------- | ------------------------------------------------------------- |
| Local touch feedback              | Under 100 ms                                                  |
| Basic UI state transition         | Under 200 ms                                                  |
| Deterministic fallback activation | Under 500 ms after failure detection                          |
| Local conversational response     | Aim for under 2 seconds to first response, hardware-dependent |
| Critical alert presentation       | Defined by hazard analysis, independent of LLM latency        |
| Ambient animation                 | 30–60 FPS on capable displays                                 |
| Low-power mode                    | Static or event-driven rendering                              |
| Network dependence                | None for essential onboard medical functions                  |
| Critical-state availability       | Mission-specific reliability and fault-tolerance analysis     |
| Data durability                   | Crash-consistent storage and recoverable event logs           |

All timing, availability, and safety targets must be verified against actual spacecraft hardware and mission requirements.

## **15. Validation and acceptance testing**

The UX is ready for mission evaluation only when it passes scenarios such as:

| Test                              | Acceptance condition                          |
| --------------------------------- | --------------------------------------------- |
| Astronaut asks about recovery     | Relevant explanation without navigating menus |
| SKY lacks reliable data           | Explicitly reports uncertainty                |
| Device loses network              | Essential local workflows continue            |
| Microphone fails                  | Alternative input remains available           |
| AR tracking fails                 | Safety information remains accessible         |
| Astronaut wears EVA gloves        | Required controls remain operable             |
| Two crew members share a display  | No unauthorized health disclosure             |
| LLM produces invalid scene        | Renderer rejects it and uses fallback         |
| Medical emergency occurs          | Safety workflow overrides ambient UI          |
| Earth response is delayed         | No false indication of real-time guidance     |
| Astronaut declines recommendation | No unauthorized action occurs                 |
| Device reboots mid-workflow       | State and audit history recover correctly     |

Testing should include simulation, human-factors studies, fatigue and workload assessment, environmental stress, hardware-in-the-loop tests, medical safety review, and operational rehearsals.

## **16. Implementation roadmap**

**Phase 1 — Living Core prototype**

Build the core animation, state machine, responsive scene renderer, voice interaction, and tablet/workstation experience using simulated health data.

Deliverable: Interactive design prototype

**Phase 2 — Multidevice runtime**

Add device capability negotiation, wrist UI, AR representation, ambient displays, audio-only support, and deterministic fallbacks.

Deliverable: Cross-device SKY runtime

**Phase 3 — Healthcare intelligence**

Integrate validated data interfaces, baseline analysis, explainable evidence, clinical records, permission controls, and approved workflows.

Deliverable: Healthcare integration testbed

**Phase 4 — Mission simulation**

Simulate communications delays, equipment failures, EVA constraints, clinical emergencies, and extended offline operation.

Deliverable: Mars mission simulation environment

**Phase 5 — Safety engineering and verification**

Perform hazard analysis, human-factors evaluation, cybersecurity testing, medical validation, and mission-specific assurance.

Deliverable: Verification evidence and safety case

## **17. Final design rules for the SKY team**

These are the rules that prevent the implementation from drifting back into an ordinary dashboard.

1. **Never introduce permanent navigation unless a safety or accessibility requirement demands it.**
2. Never represent SKY as a collection of unrelated pages.
3. Never use generic cards as the default spatial primitive.
4. Never show all health metrics simply because they are available.
5. Never make the astronaut search through menus for urgent information.
6. Never hide measurement provenance behind decorative visualization.
7. Never make an important decision dependent on an animation.
8. Never let generated UI bypass clinical authorization.
9. Never require Earth connectivity for essential onboard functions.
10. Always provide an understandable, deterministic fallback.
11. Make the Core feel alive without implying human consciousness or medical authority.
12. Design for actual mission work, not just cinematic appearance.

**The defining UX concept:** SKY should feel less like opening software and more like communicating with the spacecraft's health-support intelligence. Information should emerge when needed, take the form most appropriate to the device and task, and disappear when no longer useful.

The next concrete design artifact should be a **device-by-device interaction atlas**: a complete set of scene specifications for Presence, Attention, Understanding, Decision, Continuity, and Emergency across the command deck, tablet, wrist wearable, AR headset, EVA HUD, medical bay, sleep pod, exercise station, rover, and Earth workstation. That atlas can become the implementation contract for the OpenUI scene engine.
