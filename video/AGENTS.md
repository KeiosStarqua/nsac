# video — Sky launch film (HyperFrames)

## Purpose

Source of the **Sky — Never Alone in Space** 30-second 16:9 launch film about the web app
hosted at https://nasa.taquangkhoi.com (NASA Space Apps 2026). The composition is plain
HTML/CSS (rendered by HyperFrames to MP4); captions carry the voiceover script — the film is
silent by design.

## Ownership

- Owner: NASA Space Apps 2026 team; this folder is tracked in git (source of truth for the film).

## Local Contracts

- Compositions are **versioned files**: `index-v1.html` (archived cut) and `index-v3.html`
  (current). Preview: `npx hyperframes preview`; render: `npx hyperframes render -c index-v3.html -o out/sky-launch-30s-v3.mp4`
  (audio is muxed post-render, see `SPEC.md`). Render outputs are **versioned**
  (`out/sky-launch-30s-vN.mp4`) — always bump `N`, never overwrite an earlier version.
  `check` must run on a v3-only isolated copy — the repo keeps multiple root compositions.
- `media/` holds product screenshots used as plates (captured from the web app; fictional crew
  only, no personal data) and `media/voice/` (flite-synthesized VO, regenerate per `SPEC.md`).
  Do **not** put external media with unclear licenses in git.
- `out/` (render output, MP4) and HyperFrames caches are **not committed** — final MP4 is
  delivered locally / via the site, not in this repo.
- No secrets, no API keys in this folder (NASA public-domain or repo-owned media only).
- The film reuses the product's real UI (per the creative brief); keep a discreet
  **"SIMULATED TELEMETRY"** chip wherever the HUD is shown, and keep disclaimers intact.
- Copy is English; track the script in `index.html` directly. If the film is localized, keep
  en/vi in sync like the app.

## Work Guidance

- Format: 1920×1080, 30 fps (unless changed intentionally).
- Facts shown on screen must carry a source or be marked SIMULATED (same rule as the app).
- Beats (v3): 00:00 intro → 00:03 01/Continuous Monitoring → 00:10 02/Clinical Assistance →
  00:19 03/Connected Medical Support → 00:26 closing. Tracker label top-center per scene.
- Rendering: local Chrome via HyperFrames; do not commit `node_modules` or caches.

## Verification

- `npx hyperframes check` passes (isolated v3 copy) before sharing a render; `hyperframes snapshot`
  of key frames (2 s, 5 s, 12 s, 16 s, 22 s, 28 s).
- Visual check: `hyperframes snapshot` of key frames (04s, 10s, 15s, 17s, 24s, 29s).

## Child DOX Index

- (none — single-folder project)
