# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Primary audience for the web app (`apps/web`): the demo audience and hackathon judges at NASA Space Apps 2026 (HCMC, 14–15/11/2026), experiencing a simulated product live. In-world, the operator is the astronaut on a long-duration mission — not a ground physician. The story's secondary audience is the Earth-side counterpart: elderly long-stay patients and post-surgery patients (the same deconditioning mechanism), used as the demo's closing contrast.

## Product Purpose

Sky is a "temporary doctor" aboard the spacecraft: it watches each astronaut against their own personal baseline, coaches exercise dose to recover heart and leg function, and tracks **Mars landing readiness** (can the crew stand at 3/8 G?). It self-reports to Earth over a 20-minute-delay link. Success means the demo lands the mechanism in under 60 seconds — signals are noticed early, one clear next action is proposed, a human confirms it, and the readiness score moves — without a crash and with every threshold and weight showing its source.

## Positioning

Unlike a generic health dashboard, Sky is used by the astronaut, not the ground; it says **what to do next**, not only what is off. Its mechanism a neighboring product could not truthfully copy: per-person personal-baseline deviation detection (deterministic), a single proposed action requiring explicit crew confirmation, and a transparent, fully cited Mars-landing readiness formula (0–100) that rises when the exercise dose is completed. Deterministic detection decides; the LLM only explains, retrieves checklist items, and drafts. It never decides alone.

## Operating Context

- NASA Space Apps 2026 challenge: Create Health Monitoring Software for Astronauts on Space Missions. Submission deadline 15/11/2026 23:59 local.
- Demo scenario: ~mission day 170, 2–3 weeks before Mars landing, after a solar storm and 2 weeks of missed exercise → readiness 62 (yellow) → exercise dose proposed → Confirm → ground report queued → fast-forward → readiness 81 (green). Near landing: switches to safety advice (compression garment, supported standing), not just exercise.
- Deployed at https://nasa.taquangkhoi.com (EC2 OpfaOS, Caddy → `nsac-web.service`, 127.0.0.1:3100).
- Web app routes: `/` (Hub Gen console), `/watch`, `/performance`, `/health`, `/body`, `/spacecraft`, `/data`, `/research`, `/admin` (hidden).
- Stack (existing codebase): TanStack Start + React 19 + Bun + Turborepo, Tailwind v4, three.js, PI SDK agent harness (`sky-orchestrator`), SQLite via Bun backend (`apps/backend`).

## Capabilities and Constraints

Confirmed functionality and hard constraints future work must preserve:

- Synthetic/simulated data only (OSDR OSD-569/575 ranges, 180-day generator); no personal data; no images of minors.
- AI never decides alone: deterministic detection; LLM explains, retrieves ISS Medical Checklist items, and drafts; the astronaut confirms every action. "AI-generated, not a substitute for a physician" disclaimer must be shown.
- Every medical threshold, weight, and claim carries a source URL in code comments and on the UI.
- Readiness score 0–100: transparent formula, one cited source per weight; increases when the exercise dose is completed; fast-forward simulation supported.
- Ground report: Jinja2-rendered PDF, SQLite outbox with simulated 20-minute delay.
- Modules in scope (real): cardiovascular (HR, HRV, BP, LV/SV trend, 2 weeks), bone/muscle + exercise-dose coach, DONKI space-weather signal. Other systems (immune/blood, behavioral/cognitive, environmental) are interface-only schematics.
- Scope cut: offline operation is NOT required (dropped 2026-11-14); network/cloud is allowed in demo and runtime.
- Repo is Apache-2.0; dependencies need not be OSI-approved but attribution and license terms must be honored (e.g., React Bits MIT + Commons Clause, Open Anatomy CC BY 4.0).
- Demo under 60 seconds, no crash; all sources displayed.
- Keep the HKT hard rules and work split in root `AGENTS.md` authoritative; this file records product truth only.

Explicitly undecided product facts:
- Whether the Python (`backend/`, NiceGUI `apps/onboard/`) or TypeScript (`apps/web` + `apps/backend`) stack is canonical long-term — current direction is TypeScript + Bun per DESIGN.md; Python remains in-repo.
- No validated model exists for orthostatic tolerance at 3/8 G; the readiness score is an illustrative, cited formula — not a clinical instrument.

## Brand Commitments

- Product name: **Sky** (in-fiction: a guardian/angel for each astronaut, from the garden on the ship — see `STORY.md`).
- Voice/posture: a quiet instrument that notices change and asks for one good decision — not a doctor avatar, not a chatbot pasted on a dashboard, not a sci-fi game HUD. Presence without personality theater; calm until there is a reason not to be; embodied information; human authority (see root `DESIGN.md`, "The Quiet Instrument"; the fuller rationale is in `DESIGN-proposal-v1.md`, "Design DNA").
- All sample fixtures display **SIMULATED** visibly.
- Repo is public, Apache-2.0; README + AI disclosure + sources are required submission artifacts.
- Do not merge fixture crews (`iss-showcase`: Ayla/Dae-Jung/Lena; `hong-hac-story`: Minh/Linh/Ana/Kenji) — see `DESIGN-proposal-v1.md` §0 (fixture configurations), still in force.

## Evidence on Hand

Real, committed material future work may use (do not fabricate beyond these):

- `DESIGN.md` (root) — product-wide visual design source of truth, generated from the shipped code: token frontmatter plus the eight canonical sections, with a machine-readable sidecar at `.impeccable/design.json`. `DESIGN-proposal-v1.md` — the superseded v1.0.0 proposal, kept for the rationale, authority model, state machines and acceptance matrix that the visual system does not carry.
- `UX.md`, `UX_IMPLEMENTATION.md`, `SKY_UI_COMPONENT_FUNCTIONAL_SPEC.md`, `STORY.md`, `ARCHITECTURE.md`, `HARNESSING.md`, `SENSOR_SIMULATION_SPEC.md` — committed specs.
- `data/` git submodule (nsac-data) — demo datasets, features, models, predictions; includes `DATA.html`.
- NASA sources: OSD-569, OSD-575, OSDR API, DONKI, ISS Medical Checklist (mirror), Circulation 2026 ISS cardiovascular paper — URLs in root `README.md`.
- `apps/web/public/models/` — Open Anatomy 3D models (CC BY 4.0); `apps/web/public/astronauts/` — avatar portraits.
- No testimonials, customers, benchmarks, or pricing exist — do not invent them. No flight-hardware or medical-device claim may be made.

## Product Principles

1. **The astronaut is the operator.** Sky informs and proposes; the human confirms. AI never acts alone.
2. **Personal baseline, not population norms.** Deviation is measured against the individual, deterministically.
3. **One good decision at a time.** A single proposed action, attached to its evidence, confirmed explicitly.
4. **Every claim shows its source.** Thresholds, weights, and scores carry cited URLs, on the UI and in code.
5. **Calm by default; honest under failure.** Nearly still in the normal state; simpler in weak connectivity or failure — never more magical.

## Accessibility & Inclusion

WCAG 2.2 AA is a design input per root `DESIGN.md` (with NASA-STD-3001 Volume 2 as reference); neither implies NASA approval or tested compliance. No product-specific user-needs requirement beyond that has been established. All content is SIMULATED; no personal or minor data.
