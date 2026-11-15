# video — Sky launch film (HyperFrames)

## Purpose

Source of the **Sky — Never Alone in Space** 30-second 16:9 launch film about the web app
hosted at https://nasa.taquangkhoi.com (NASA Space Apps 2026). The composition is plain
HTML/CSS (rendered by HyperFrames to MP4); captions carry the voiceover script — the film is
silent by design.

## Ownership

- Owner: NASA Space Apps 2026 team; this folder is tracked in git (source of truth for the film).

## Local Contracts

- Entry point: `index.html` (HyperFrames composition). Preview: `npx hyperframes preview`;
  render: `npx hyperframes render -o out/sky-launch-30s.mp4`.
- `media/` holds product screenshots used as plates (captured from the web app; fictional crew
  only, no personal data). Do **not** put external media with unclear licenses in git.
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
- Beats: 00:00 isolation → 00:05 meet Sky → 00:10 intelligence (HUD) → 00:16 connection
  (chat + readiness) → 00:23 promise (`/spacecraft`) → 00:27 SKY reveal + URL.
- Rendering: local Chrome via HyperFrames; do not commit `node_modules` or caches.

## Verification

- `npx hyperframes lint` and `npx hyperframes inspect` pass before sharing a render.
- Visual check: `hyperframes snapshot` of key frames (04s, 10s, 15s, 17s, 24s, 29s).

## Child DOX Index

- (none — single-folder project)
