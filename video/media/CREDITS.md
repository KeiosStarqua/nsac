# CREDITS — video/media (Sky launch film)

Film v1: **Sky — Never Alone in Space** · v3: **SKY — 30-Second Product Launch** · NASA Space Apps 2026 · https://nasa.taquangkhoi.com

## NASA (public domain, used with credit)

Retrieved 2026-11-15 from the NASA Image and Video Library (https://images-api.nasa.gov).
NASA media may be used for informational purposes; NASA does not endorse this product or any organization.

| File | Title | NASA ID | Credit |
|---|---|---|---|
| nasa/s134e010062.jpg | Partial view of the ISS and Earth's Horizon at Night (STS-134; Endeavour docked, May 2011) | s134e010062 | NASA |
| Source | https://images-assets.nasa.gov/image/s134e010062/s134e010062~orig.jpg | | |

## App plates (captured in-repo)

Every screenshot and clip was captured from the Sky web app itself by headless Chromium —
local build of `apps/web` @ origin/main at `http://127.0.0.1:3000` (offline; backend unreachable →
claims gracefully off), or read-only pages of the live demo https://nasa.taquangkhoi.com.
No personal data; the crew is fictional. Never send/save anything to the demo backend.

| File | Source |
|---|---|
| body.png | Local build, `/body` — Open Anatomy 3D hologram, CC BY 4.0 (see repo THIRD_PARTY_NOTICES.md) |
| clips/hud-loop-slow.mp4 | Local build, `/` — idle HUD, 10 fps source slowed ×1.75 to 24 fps |
| clips/chat.mp4 | Local build, `/` — chat card open, "Type instead", question typed (no send) |
| clips/spacecraft.mp4 | Live demo, `/spacecraft` — ISS 3D (NASA/JSC model) auto-orbit drift |

Third-party components visible in plates: React Bits (MIT + Commons Clause, attribution kept),
shadcn AI Elements (MIT, adapted), beui avatar group (MIT, adapted). Sky app code: Apache-2.0.

## v3 voiceover (synthesized locally, no external assets)

Generated 2026-11-15 with ffmpeg `libflite` (CMU Flite, Festvox voices) — narrator `slt`,
astronaut question `kal`. No human recordings or cloned voices.
Robotic by design; replace with a human/production TTS before public submission (mix recipe in
`../SPEC.md`). v3 uses **no NASA media** (it is product plates + CSS only); the NASA photo above
is v1-only.

| File | Voice | Line |
|---|---|---|
| voice/vo-1.wav … vo-6.wav | `slt` (vo-3: `kal`) | **archived — not used**: standing rule forbids voiceover |
| voice/vo-mix.m4a | mixed | adelay 0.1/3.25/10.6/12.9/19.3/26.6 s → loudnorm −16 LUFS |

## v3 music and sound effects (ElevenLabs CLI)

Generated 2026-11-15 with `npx @elevenlabs/cli` (account-authenticated CLI; no key stored in the
repo). Review applicable ElevenLabs subscription/licensing terms before public or commercial
distribution. v3 uses **no NASA media**; the NASA photo above is v1-only.

| File | Prompt intent |
|---|---|
| audio/music-bed.mp3 | 30 s restrained, hopeful cinematic ambient instrumental; no vocals |
| audio/sfx-whoosh.mp3 | soft airy transition sweep |
| audio/sfx-ping.mp3 | subtle glassy medical-interface notification |
| audio/sfx-shimmer.mp3 | holographic interface materialization |
| audio/sfx-bloom.mp3 | low, weightless cinematic bloom for intro/outro |
| audio/soundtrack-v3.m4a | final VO + music + SFX mix (timing/levels in `../SPEC.md`) |
