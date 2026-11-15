---
name: SKY
description: A quiet clinical instrument for astronauts — a deep navy field, one sea-glass accent, and glass panels on a radial stage.
colors:
  night-ink: "#070b14"
  stage-deep: "#010812"
  stage-mid: "#091c32"
  stage-halo: "#0c3159"
  surface-navy: "#111a2e"
  surface-raised: "#17223b"
  line-slate: "#243252"
  line-slate-soft: "#1e293b"
  glass-line: "#7adeff"
  glass-veil: "rgba(11, 36, 58, 0.5)"
  card-wash: "rgba(13, 31, 54, 0.86)"
  tag-wash: "rgba(94, 234, 212, 0.1)"
  tab-wash: "rgba(120, 234, 255, 0.12)"
  mini-wash: "rgba(9, 24, 42, 0.7)"
  text-primary: "#edf8ff"
  text-bright: "#f2fbff"
  text-body: "#cfe4f4"
  text-muted: "#8fb8d4"
  text-dim: "#7f9db4"
  text-ui: "#e7edf7"
  text-ui-muted: "#98a6bd"
  accent-sea: "#5eead4"
  accent-sea-soft: "#8ef0d9"
  accent-ink: "#04201c"
  accent-cyan: "#7fe0ff"
  accent-blue: "#7ab8ff"
  accent-violet: "#a78bfa"
  status-steady: "#60efc0"
  status-watch: "#fbbf24"
  status-critical: "#f87171"
  status-simulated: "#c8f79a"
  focus-outline: "#f5fcff"
  watch-black: "#000000"
  watch-label: "#f2f4fc"
  watch-cyan: "#3cd3fe"
typography:
  display:
    fontFamily: "Inter, Manrope, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif"
    fontSize: "clamp(19px, 2vw, 28px)"
    fontWeight: 300
    lineHeight: 1.25
    letterSpacing: "0.013em"
  title:
    fontFamily: "Inter, Manrope, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif"
    fontSize: "17px"
    fontWeight: 300
    lineHeight: 1.2
    letterSpacing: "0em"
  metric:
    fontFamily: "Inter, Manrope, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif"
    fontSize: "30px"
    fontWeight: 300
    lineHeight: 1
    letterSpacing: "-0.02em"
    fontFeature: "tabular-nums"
  body:
    fontFamily: "Inter, Manrope, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif"
    fontSize: "12px"
    fontWeight: 300
    lineHeight: 1.5
    letterSpacing: "0em"
  control:
    fontFamily: "Inter, Manrope, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif"
    fontSize: "14px"
    fontWeight: 600
    lineHeight: 1.4
    letterSpacing: "0em"
  label:
    fontFamily: "Inter, Manrope, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif"
    fontSize: "10px"
    fontWeight: 500
    lineHeight: 1.35
    letterSpacing: "0.18em"
  micro:
    fontFamily: "Inter, Manrope, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif"
    fontSize: "9px"
    fontWeight: 400
    lineHeight: 1.4
    letterSpacing: "0.16em"
  mono:
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace"
    fontSize: "12px"
    fontWeight: 400
    lineHeight: 1
    letterSpacing: "0.12em"
rounded:
  tile: "14px"
  control: "10px"
  card: "18px"
  panel: "20px"
  pill: "9999px"
  glass: "49% 48% 46% 51% / 20% 26% 18% 23%"
spacing:
  hairline: "2px"
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "20px"
  gutter: "24px"
components:
  button-primary:
    backgroundColor: "{colors.accent-sea}"
    textColor: "{colors.accent-ink}"
    rounded: "{rounded.control}"
    padding: "10px 18px"
    typography: "{typography.control}"
  button-primary-hover:
    backgroundColor: "{colors.accent-sea-soft}"
    textColor: "{colors.accent-ink}"
    rounded: "{rounded.control}"
  button-ghost:
    backgroundColor: "{colors.night-ink}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.control}"
    padding: "10px 18px"
  button-danger:
    backgroundColor: "{colors.night-ink}"
    textColor: "{colors.status-critical}"
    rounded: "{rounded.control}"
    padding: "10px 18px"
  nav-chip:
    backgroundColor: "{colors.glass-veil}"
    textColor: "{colors.accent-cyan}"
    rounded: "{rounded.pill}"
    padding: "6px 11px"
  tag:
    backgroundColor: "{colors.glass-veil}"
    textColor: "{colors.text-muted}"
    rounded: "{rounded.pill}"
    padding: "3px 9px"
  tag-accent:
    backgroundColor: "{colors.tag-wash}"
    textColor: "{colors.accent-sea-soft}"
    rounded: "{rounded.pill}"
    padding: "3px 9px"
  card:
    backgroundColor: "{colors.card-wash}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.card}"
    padding: "14px"
  card-mini:
    backgroundColor: "{colors.mini-wash}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.tile}"
    padding: "11px"
  tab-active:
    backgroundColor: "{colors.tab-wash}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.pill}"
    padding: "6px 10px"
  input:
    backgroundColor: "{colors.surface-navy}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.control}"
    padding: "10px 12px"
---

# Design System: SKY

## Overview

**Creative North Star: "The Quiet Instrument"**

Sky looks like a crew instrument that is watching, not like a dashboard wearing a space theme. The field is a deep navy that grades from a lit halo at the top of the viewport down to near-black; information sits on glass panels that float just above it; one sea-glass teal marks the thing that is currently actionable. Nothing else competes. Presence is carried by a single luminous object — the orb — and by the quality of attention in the copy, never by decoration.

The system is dark-only (`color-scheme: dark`, `<html data-theme="dark">`) and it is a *reading* surface more than a *browsing* one: an astronaut glances, understands what changed, and answers once. That is why types are light-weight, why measurements are tabular, why labels are small letter-spaced caps, and why the accent is rationed. Depth comes from tonal gradients and 1px translucent cyan borders, not from drop shadows.

Two registers share one identity. The **stage** register is the HUD (`/`), the cinematic routes (`/body`, `/spacecraft`) and the two data faces (`/performance`, `/research`): radial backdrop, glass cards, glow accents. The **instrument** register is where an operator completes a task (`/admin`, the crew picker, the watch face): flat fills, solid slate borders, real shadows, 14px type. Both use the same palette and the same sea-glass accent; the stage never hosts a settings form, and an instrument surface never hosts a hero orb.

Scope note: this file documents the shipped visual system (tokens in `apps/web/src/styles/global.css` and the Tailwind class contracts in `features/*/*-classes.ts`). The long-form rationale and interaction contracts — Canopy/Aperture/Horizon/Tether, the A0–A4 authority table, operational modes, state machines, acceptance matrix — live in `DESIGN-proposal-v1.md`. Product truth lives in `PRODUCT.md`.

**Key Characteristics:**
- Deep navy radial stage (`#010812` → `#091c32` → `#0c3159`), never pure black except on the watch face.
- One primary accent — sea-glass teal (`#5eead4`) — plus an instrument cyan and a violet that appears only inside gradients and rims.
- Glass panels: 18px radius, 1px `rgba(122,222,255,.15)` border, gradient fill, 8px backdrop blur, 1px inset top highlight.
- Light-weight type (300) at every size; uppercase micro-labels at 9–11px with .14–.2em tracking; tabular numerals for every measurement.
- Pills for all chrome (chips, tabs, tags, voice controls); asymmetric organic radii only for glass cutouts.
- Depth by glow and tonal layering, not by shadow.
- `SIMULATED` is always visible on fixture data; every threshold and score carries its source.

## Colors

A single cool family: navy mineral field, sea-glass and instrument cyan for interaction, one violet that only ever glows inside a gradient, and three status colours used as text-and-shape, never as atmosphere.

### Primary
- **Sea-glass Teal** (`#5eead4`): the actionable object and nothing else — the primary button in the instrument register, a selected crew card, the live mic accent, the reading line of a sparkline, the "safe/steady" word.
- **Sea-glass Soft** (`#8ef0d9`): teal at reading size, for accent text that must stay legible on navy (tags, deltas, insight kicker, interactive hints).
- **Teal Ink** (`#04201c`): the only text colour ever placed on a teal fill; near-black green keeps the contrast at AA without a second hue.

### Secondary
- **Instrument Cyan** (`#7fe0ff`): icons, row glyphs, the active-tab surface, the "measured data" line. It is a *data* colour, cooler and weaker than the accent.
- **Signal Blue** (`#7ab8ff`): the middle stop of every multi-hue gradient (readiness arc, progress bars) and the hover lift on chrome.
- **Spectral Violet** (`#a78bfa`): the far stop of the same gradients, the `thinking` halo, and the sleep block. Never a fill for a whole surface.
- **Glass Line** (`#7adeff`): the hue behind every translucent border (`rgba(122,222,255,…)` at 8–35% alpha) and the canvas of the stage vignette.

### Neutral
- **Night Ink** (`#070b14`): the document background and the base the two body glows sit on.
- **Stage Deep / Mid / Halo** (`#010812`, `#091c32`, `#0c3159`): the three stops of the radial stage gradient — deep at the bottom edge, halo at the top.
- **Surface Navy / Raised** (`#111a2e`, `#17223b`): flat instrument surfaces; the second is the *muted / secondary* token for the semantic bridge.
- **Line Slate** (`#243252`) and **Line Slate Soft** (`#1e293b`): solid instrument borders (inputs, picker cards, admin panels). Solid lines belong to the instrument register; glass uses alpha cyan.
- **Text Primary** (`#edf8ff`): default text on the stage.
- **Text Bright** (`#f2fbff`): the number that is the point — gauge value, mini-card value.
- **Text Body** (`#cfe4f4`): row labels and secondary sentences.
- **Text Muted** (`#8fb8d4`): chips, captions, units on the stage.
- **Text Dim** (`#7f9db4`): eyebrows and kickers — the quietest readable step.
- **Text UI / UI Muted** (`#e7edf7`, `#98a6bd`): the instrument register's neutral pair (picker, modals).
- **Translucent fills** (`rgba(11,36,58,0.5)` chrome, `rgba(13,31,54,0.86)` card base, `rgba(9,24,42,0.7)` mini card, `rgba(94,234,212,0.1)` accent wash, `rgba(120,234,255,0.12)` active tab): every surface that must show the stage through it. They sit over the gradient only — never over artwork or an image.

### Tertiary
- **Steady Green** (`#60efc0`): the readiness/health status word — teal-leaning green so it reads as "steady", not as "success toast".
- **Watch Amber** (`#fbbf24`) and **Critical Coral** (`#f87171`): review-required and reviewed-critical. Text + state word + icon, never a glowing panel.
- **Simulated Lime** (`#c8f79a`): the only place lime appears — the simulated/estimated chip.
- **Watch Black / Label / Cyan** (`#000000`, `#f2f4fc`, `#3cd3fe`): the watch face's true-black display and watchOS-derived label/accent pair; kept separate from the stage palette on purpose.

### Named Rules

**The One Bright Object Rule.** Exactly one luminous focal object per screen: the orb, or the body hologram, or an open decision — never two. When the decision is active, the orb dims; when the body is active, the orb steps back.

**The Rare Teal Rule.** Sea-glass teal appears on ≤10% of any screen. Its rarity is what makes it read as "this is the thing to act on". Painting every number teal destroys the only hierarchy signal the system has.

**The Gradient-Rim Rule.** Multi-hue gradients (teal → blue → violet, or teal → violet) live only in a 1px rim, an arc, a progress fill, or the around-a-pill border technique — never as the fill of a surface, never on text.

## Typography

**Display Font:** the declared stack is `Inter, Manrope, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif` — neither Inter nor Manrope ships a font file, so the app's own chrome resolves to the platform UI font. The single exception is the vendored React Bits `VariableProximity` label (staged HUD `?gen=0` and the OpenUI catalog), which `@import`s Roboto Flex from Google Fonts; no other part of the UI pulls a webfont.
**Body Font:** the same stack.
**Label/Mono Font:** `ui-monospace, SFMono-Regular, Menlo, Consolas, monospace` for timers, ids, kbd chips and severity codes.

**Character:** One family, one weight discipline, two registers of size. Light weight at large sizes makes numerals feel instrument-like rather than promotional; small letter-spaced caps carry the metadata; monospace is reserved for things that are literally machine output.

### Hierarchy
- **Display** (300, `clamp(19px, 2vw, 28px)`, 1.25): the greeting above the orb, one per screen. Sentence case, no tracking tricks. The staged HUD scales it to `clamp(25px, 2.7vw, 44px)` — same weight, bigger room.
- **Title** (300, 17px, 1.2): crew name, card titles in the profile block.
- **Metric** (300, 30px, 1.0, `-0.02em`, tabular): the one number that answers the panel's question. The gauge and mini cards sit at 19–30px; the staged detail panel goes to 37px. Units ride along at 10–12px muted, never in the same size.
- **Body** (300, 12px, 1.5): row values, insight sentence, panel rows. 11–13.5px across the HUD; 14px everywhere in the instrument register.
- **Label** (500, 10px baseline, .14–.2em, uppercase): card titles (11px), tab labels, chip text, mission chip. Never a sentence — caps + tracking is metadata grammar only.
- **Micro** (400, 9px, .16em, uppercase): eyebrows, demo markers, `SIMULATED`, the footer note. The floor: nothing reads below 8.5px.
- **Mono** (400, 12px, .12em): the listening timer (`38px` when live), `⌘K` kbd chips, monospaced severity/engine pills.

### Named Rules

**The Light-Weight Rule.** Interface text is `font-weight: 300`; 400 is for micro-labels, 500 for uppercase labels, 600 only for the two button roles and crew names. A 700-weight headline is a different product.

**The Micro-Label Rule.** Uppercase with .14–.2em tracking is allowed only at ≤11px and only for labels, chips, and stamps. Setting a sentence in tracked caps is the anti-pattern the whole system was built to avoid.

**The Tabular Rule.** Every measurement, delta, countdown and score is `tabular-nums`; every unit is a separate `<small>` or span at 10–12px in `{colors.text-muted}`. Numbers never animate between values.

## Layout

The stage is a full-viewport radial gradient (`radial-gradient(ellipse 95% 90% at 52% -8%, #0c3159 0%, #091c32 49%, #04111f 78%, #010812 100%)`) under a vignette that fades the outer edges toward `#010812`. Content sits above it in a three-column grid, max width **1720px**.

- **≥1101px** — `400px | minmax(0,1fr) | 560px` with `grid-template-areas: left center right`, gaps 20px, page padding 24px. The root is pinned to `h-dvh` with `overflow:hidden`; the grid is `flex-1 min-h-0` and each column scrolls internally, so the document never scrolls on a normal laptop. Free height is distributed by `justify-evenly` inside cards, not by growing gaps.
- **721–1100px** — two columns `minmax(0,400px) | minmax(0,1fr)`; the right column drops under the centre (`'left center' 'right right'`). The page scrolls vertically again.
- **<721px** — one column, `minmax(0,1fr)`, page scroll; the orb caps at `min(72vw, 300px)`.
- Nothing ever scrolls horizontally: every grid track is `minmax(0, …)` and the root is `overflow-x-hidden`.

The **staged HUD** (`?gen=0`) is the exception: an absolute composition anchored in percentages on a 1672×941 stage (`left-[5.1%] top-[12.1%]`, orb at `left-[50.6%] top-[26.3%]`), scaled by transform at 1300 / 1000 / 720 / 420px rather than reflowed. Treat it as a fixed composition; new screens use the responsive grid.

Page routes (`/performance`, `/research`) use a centred column (`max-w-[1440px]`, `px-4 sm:px-7 lg:px-10`, `pt-6 pb-9`) over a violet-teal page backdrop: `radial-gradient(120% 85% at 82% -12%, rgba(90,78,236,.20), transparent 56%), radial-gradient(95% 70% at -5% 0%, rgba(16,116,148,.22), transparent 62%), linear-gradient(180deg, #070b14, #060a12 62%, #04070e)`. Operator routes (`/admin`) centre at 1040px.

The **watch** face is not laid out in px: the live HUD is clipped into the mockup glass (`53.3% × 53.4%` of the device, `border-radius: 22%/20%`), `container-type: size`, and everything inside sizes in `cqw`/`cqh` so it survives 160×240.

Spacing rhythm is 4px-based: 2px hairlines, 3–4px gaps inside chips and tabs, 6–9px inside rows, 11–14px card padding, 16–20px grid gaps, 24px page gutter, 56px bottom band under the grid so the footer never covers content. Safe-area insets (`env(safe-area-inset-*)`) pad the header, watch stage and floating chrome.

## Elevation & Depth

Depth is tonal, not cast. A panel sits above the field because its fill is a `linear-gradient(160deg, rgba(13,31,54,.86), rgba(7,18,33,.92))`, its border is a 1px `rgba(122,222,255,.15)` hairline, it carries `inset 0 1px 0 rgba(255,255,255,.04)` as a top highlight, and it blurs the stage 8px behind it. Shadows exist only in the **instrument** register and behind floating surfaces.

Glow is the attention currency: `drop-shadow` on the orb (`rgba(68,172,255,.24)`, deepening to `rgba(171,142,255,.33)` while thinking), a teal halo under the mic (`0 0 28px rgba(94,234,212,.22)`), a soft bloom under the insight band (`0 0 24px -8px rgba(94,234,212,.45)`). Glows are always low-alpha, always outside the element, and never behind text that must be read.

### Shadow Vocabulary
- **Instrument rest** (`0 1px 2px rgb(0 0 0 / .4)`): flat admin surfaces and inputs.
- **Floating panel** (`0 20px 60px -20px rgba(0,0,0,.6)`): the astronaut picker modal.
- **Chat card** (`0 0 44px rgba(94,240,214,.14), 0 0 80px rgba(178,112,255,.16)`): the one surface that gets a coloured bloom, because it floats above the HUD and must not look like part of it.
- **Stage glow** (per-component `drop-shadow`/`box-shadow` with teal, cyan or violet at 8–45% alpha): attention, never elevation.

### Named Rules

**The Glow-Not-Shadow Rule.** On the stage, an element is raised by a tonal gradient and a glow — never by a grey drop shadow. A grey shadow on the navy field reads as dirt.

**The One Halo Rule.** At most one element per screen carries a coloured outer bloom. Two competing halos is the visual signature of a HUD mock, not of an instrument.

## Shapes

**Pills are the chrome.** Every control you press outside a panel — mission chip, device switcher, nav link, tag, tab, voice pill, "type instead", insight band — is a full pill (`9999px`). Pills read as instrument labels; rectangles read as web forms.

**Panels are gently rounded rectangles.** Cards are 18px, mini cards and the hologram frame 14px, the chat card 20px, controls 10px (instrument) — the radius tells you which register you are in.

**Apertures are organic.** The one place the system allows asymmetry is a cutout that holds a subject: the detail glass (`49% 48% 46% 51% / 20% 26% 18% 23%`), the vitals shield (`64% 40% 40% 55% / 47% 55% 40% 50%`) and the health shield. Used at most once per screen, always with a 1px cyan border and a soft interior radial — never as a decorative blob on a card.

**The brand mark is a ring of light.** A 57px (38px on page routes) circle whose border is a `conic-gradient` from `transparent` through `#8defff`, `#a4aaff`, `#fff` and back, with a `0 0 18px rgba(105,192,255,.26)` halo and an inset counterpart. It is the only element with a 2–3px border.

**Hairlines are 1px at ≤35% alpha.** Section separators, row dividers (`rgba(122,222,255,.08)`), the mission underline (a 1px gradient rule, 235px wide, rotated −5°). Nothing uses a 2px divider on the stage.

### Named Rules

**The Pill-For-Chrome Rule.** If it is chrome, it is a pill; if it holds content, it is a rounded rectangle. A square button in the HUD, or a pill around a card, is a register error.

**The One Aperture Rule.** One organic cutout per screen, and only around a subject that carries data. A second organic shape turns an instrument into a poster.

## Components

### Buttons
- **Shape:** 10px radius in the instrument register; full pill in the chrome.
- **Primary:** sea-glass fill (`#5eead4`) with teal ink (`#04201c`), 14px/600, `10px 18px`. Raw `button{font:inherit}` reset means font-size and radius need the `!` important suffix in Tailwind.
- **Hover / Focus:** primary lifts to `#8ef0d9`; ghost buttons shift their border to teal and their label to `#e6fbff`; the console focus ring is `outline: 2px solid #f5fcff; outline-offset: 3–5px` and is never suppressed. `:focus-visible` only.
- **Ghost / Danger:** transparent fill with a 1px `#243252` border (ghost) or `#f87171` border and coral label (destructive, admin only). Both disabled at 60% opacity.

### Chips
- **Tag:** pill, 1px `rgba(122,222,255,.28)`, fill `rgba(11,36,58,.55)`, 9px uppercase `.14em` in `#8fb8d4`.
- **Accent tag:** identical geometry with a teal border (`rgba(94,234,212,.34)`), teal wash (`.1`), label `#8ef0d9`.
- **Simulated chip:** lime label `#c8f79a` on `rgba(163,230,53,.1)`; sits on the card, not in a footer, and is never removed for a screenshot.
- **Nav chip (action):** pill, `rgba(122,222,255,.3)` border, fill `rgba(11,36,58,.5)`, 10px/500 uppercase `.14em` in `#c8ecff`; hover brightens border to `#8ce7ff` and adds a 16px cyan bloom. Hidden below 480px on `/`.

### Cards / Containers
- **Corner Style:** 18px (stage card), 14px (mini card, hologram frame), 20px (chat card).
- **Background:** `linear-gradient(160deg, rgba(13,31,54,.86), rgba(7,18,33,.92))`; mini cards use a flat `rgba(9,24,42,.7)`.
- **Shadow Strategy:** inset top highlight + optional 8px backdrop blur; no outer shadow (see Elevation).
- **Border:** 1px `rgba(122,222,255,.15)`; hover raises to teal (`rgba(94,234,212,.28)`) for clickable cards.
- **Internal Padding:** 14px (card), 11px (mini), `34px 40px` (detail glass).

### Inputs / Fields
- **Style:** 10px radius, 1px `#243252`, fill `#111a2e`, 14px text, `10px 12px`.
- **Focus:** the global `:focus-visible` ring — 2px accent outline at 3px offset. The textarea in the chat card is hand-styled (no border, transparent, 110px floor / 220px cap).
- **Error / Disabled:** errors are a line of coral text under the field or a quiet banner in the card; a disabled control is 60% opacity, never a different colour.

### Navigation
- **Style:** no sidebar, no tab bar in the app shell. Chrome is a row of pills in the header (brand · mission chip ⌄ · language · Console | Watch · SPACECRAFT) and a pill showcase in the right column. The console's only global shortcut is `⌘K`/`Ctrl+K` for chat; `Esc` closes overlays.
- **Device switching is a route, not a query param:** `/` console, `/watch` watch. A device view never hides behind `?device=`.
- **Tabs:** inside a card, a pill well (`rgba(7,18,33,.6)`, border `.16`, 3px padding) holding equal-width pill buttons; active = `rgba(120,234,255,.12)` fill, `rgba(140,231,255,.5)` border, `#d9f6ff` label, plus an inset 1px highlight.
- **The operator page uses one shared tab bar for five routes** (beui morphing tabs, re-themed: navy rail, teal liquid surface, teal ink on the active tab) — the tab is a real navigation, so deep links and back/forward work.

### Orb (signature)
The `SkyOrb` is a Crystalized Ball shader at `size 0.72` inside a square zone capped at `clamp(220px, 36dvh, 420px)`, with a cyan `drop-shadow` halo that deepens to violet while thinking. It renders strictly from a six-state table — `idle` aurora calm, `connecting` aurora charged, `listening` frost, `thinking` nebula, `speaking` solar, `error` ember — with the particle count pinned at 15,000 so a state change never rebuilds the buffer. Orb colour is **assistant state only**; it is never health status, and there is no fallback glow ring behind it.

### Voice controls (signature)
- **Idle:** the React Bits VoicePill at 84px, fill `#0e2233`, icon `#bfe6ef`, accent `#5eead4`, glow `0 0 28px rgba(94,234,212,.22), 0 0 10px rgba(120,234,255,.25)`.
- **Live:** the ListeningBar replaces it — `min(560px,92vw) × 116px` glass pill, gradient rim `#5cf0d0 → #b372ff` via the padding-box/border-box double background, a 46-bar analyser canvas (250×56) driven by real frequency bins, a `38px` mono `mm:ss` timer, a 1px divider, and a 54px rounded-square stop tile in `linear-gradient(180deg,#3bf0c3,#1fc9a2)` with a `#06352c` glyph. Reduced motion turns the enter transition off; it never turns the state off.
- **Type instead:** a 56px glass pill with the same rim at 55% alpha, `MessageCircle` glyph, the label at 19px/300, and a mono `⌘K` kbd chip (`rgba(94,140,255,.16)`, 1px `rgba(160,220,255,.35)`).
- **Cluster:** the whole voice cluster dims to `opacity .45` and `scale .85` (240ms) while the chat card is open, so the HUD stays readable behind it.

### Chat card (signature)
Floating, portalled: a dismissable `rgba(2,12,28,.35)` backdrop with 2px blur under a card at `min(600px,84dvh) × min(560px,94vw)`, bottom-right 16px, 20px radius, fill `#0b1a34 → #081427` with a `rgba(92,240,208,.5) → rgba(179,114,255,.5)` rim and a teal/violet outer bloom. It fades and rises 8px over ~180ms; ≤480px it goes full-bleed with no radius and no transition. Header is a glyph + title, one volume toggle, one close; the composer is a borderless textarea with a "Use voice" pill, an enter-to-send hint, and a 56px gradient send tile.

### Readiness gauge (signature)
A 104px ring, 8px stroke, track `rgba(122,222,255,.14)`, fill a diagonal gradient `#5eead4 → #7ab8ff (55%) → #a78bfa`, round caps, rotated −90°. Value centred at 30px/300 in `#f2fbff` with a `/100` at 11px muted; the status word sits to the side at 15px in `#60efc0`. A gauge with no valid coverage shows no number.

### Data marks
- **Sparkline:** hand-rolled inline SVG (no client JS): 1.6px teal polyline, 10% teal area fill, a 1.9px `#b8fff1` end dot, `vector-effect: non-scaling-stroke`, `aria-hidden`.
- **Row bar:** 3px track `rgba(122,222,255,.14)`, fill `linear-gradient(90deg,#5eead4,#7ab8ff 70%,#a78bfa)`. Bar width is an illustrative per-row scale, never a threshold.
- **Severity dot:** 8–10px with a soft glow of its own colour, `#34d399` / `#fbbf24` / `#f87171`, grey when unknown — always paired with the severity word.
- **Sleep blocks:** 18px bar of 3px-radius segments in `linear-gradient(180deg,#a78bfa,#7c5cf0)`.

### Hologram frame
A 14px-radius frame, `aspect-ratio: 2/3`, 1px `rgba(122,222,255,.14)`, interior radial `rgba(41,207,246,.14) → rgba(9,27,48,.5)`, capped by `clamp(150px, 26dvh, 320px)` height. It holds a lazy three.js body (skin + skeleton only, 0.15 rad/s spin, `pointer-events:none`, `aria-hidden`) and falls back to a static SVG figure on first paint, no-WebGL, and load failure. The CC BY 4.0 credit line rides under the frame.

## Do's and Don'ts

### Do:
- **Do** keep one bright object per screen; dim the orb when the readiness panel or a decision is the focus.
- **Do** spend sea-glass teal on the actionable element only, and keep it under ~10% of the surface.
- **Do** build panels from gradient fill + 1px alpha-cyan border + inset top highlight; add `backdrop-blur-[8px]` only where the stage shows through.
- **Do** keep every measurement tabular, with its unit separate and muted, and every score labelled with its source or `SIMULATED`.
- **Do** show the `SIMULATED` chip on any fixture value, on the card itself, at ≥8.5px — never only in a footer.
- **Do** keep the focus ring at 2px `#f5fcff`, offset 3–5px, on every interactive element including canvases and the picker.
- **Do** ship both languages through `shared/i18n` and let the widest string drive the layout.
- **Do** give every state a word, not only a colour: `unknown`, `stale`, `queued`, `acknowledged`, `needs review`.
- **Do** treat reduced motion as a first-class state: `motion-reduce:animate-none!` on every animation and `behavior:auto` on scroll.

### Don't:
- **Do not** add a webfont, CDN stylesheet, or remote image for the app's own chrome — the type stack resolving to the platform face *is* the system. The vendored React Bits `VariableProximity` label (Roboto Flex via Google Fonts) is the one exception on the staged HUD, not a precedent.
- **Do not** use red or amber to dramatise AI text, a delta, or a trend; coral is for reviewed critical states only, and a 30-day delta is neutral teal.
- **Do not** paint a card with a violet or purple gradient; violet lives in rims, arcs and the thinking halo.
- **Do not** use a purple–cyan gradient as a surface fill, a glowing rectangle around every card, a left sidebar, or a 4–8 equal-KPI grid — those are the anti-references this system exists to refuse.
- **Do not** set body text in tracked uppercase, use 700 weights, or drop any readable text below 8.5px.
- **Do not** animate numbers between values, simulate a waveform from nothing, or leave an infinite idle animation beyond the slow orb drift and the chest glow.
- **Do not** add a third backdrop to `/`, another device view behind a query param, or a second organic aperture to one screen.
- **Do not** let a generated label (or an LLM) author a threshold, a severity, or a "stable/safe" verdict; the interface must render absence as `unknown`, never as green.
- **Do not** treat acknowledgement as resolution, confirmation as performance, or queued as transmitted — the copy and the visual state must keep those apart.
