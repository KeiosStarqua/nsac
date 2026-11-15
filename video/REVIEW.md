# REVIEW — SKY · 30-Second Product Launch — v3

Review pass on the v3 composition (`video/index-v3.html`), run before and after the first
render. Frames inspected as stills (`ffmpeg -ss <t> -frames:v 1`: 1.5, 4.5, 7.0, 12.2, 15.6,
20.9, 21.6, 23.4, 28.4 s). The film was **not** watched back at full speed; audio was
loudness-normalized but not listened to by anyone but the authoring pipeline.

## Creative calls

- **No voiceover (standing rule, Keios 2026-11-15).** All narration is on-screen text; the audio
  bed is music + SFX only. Earlier flite VO stems stay archived in `media/voice/` and are not mixed.

- **Brief-literal scene order.** Intro → Monitoring → Clinical → Surgeon → Closing, with the
  screenplay's own tracker labels ("01 / CONTINUOUS MONITORING", "02 / INTELLIGENT CLINICAL
  ASSISTANCE", "03 / CONNECTED MEDICAL SUPPORT") as the recurring motif.
- **The product plate is the monitoring scene; concept mocks carry the rest.** Scenes 03–04
  render as on-camera CSS mocks because the clinical-guidance and flight-surgeon screens do not
  exist in the app. They are labeled on screen ("SIMULATED", "CONCEPT · SIMULATED", "NOT A LIVE
  SYSTEM", "not medical diagnosis") per the brief's honesty requirement — nothing implies
  autonomous diagnosis or a shipped surgeon console.
- **Voiceover is synthesized, not performed.** ffmpeg libflite (CMU Festvox `slt` narrator,
  `kal` for "Sky, I'm feeling dizzy."). Robotic by construction. This is fine for timing reference
  and internal review; **replace with a human read or a production TTS before any public submission.**
- **Every on-screen number is the app's fixture** (62 / 118/76 / 98 % / 7 h 42 m / 32.1 kg muscle,
  Day 170, Ayla R.). No new clinical claim was introduced. The amber "unusual trend" is a
  fixture moment, labeled amber — not a severity story.
- **No music.** The brief asked for energy, not a bed; kept the v1 silent-VO register.

## Measured vs. looked at

- Measured: `hyperframes check` **in an isolated copy** (v3-only project) → `ok: true`,
  0 errors. (The repo keeps `index-v1.html` beside `index-v3.html`; `check` on the shared folder
  fails with `multiple_root_compositions`, so v3 is verified isolated. Rendering uses `-c index-v3.html`.)
  Render: 1920×1080, 30 fps, 900 frames, 30.000 s, h264; mux AAC 160 kbps; loudnorm −16 LUFS.
- Only looked at: pacing between stills; caption/VO legibility at distance.
- Not checked: full-speed watch; phonetic quality of the flite render.

## What this pass fixed (v3 first render)

1. **Arrows vanished mid-scene** — `.flow-arrow` clips had `data-duration` ≈ draw time, so the
   arrows disappeared as soon as they finished (20.85 s / 21.65 s). Extended to 5.5 s / 4.5 s.
2. **`#earthLine` struck through the closing tagline** — moved from 55.5 % to 50.2 % of height;
   horizon now sits under the wordmark, tagline reads clean.
3. **HyperFrames StaticGuard rejects hidden→keyframe pings** — removed `opacity: 0` from the
   three ping rings (same pattern v1 uses); convergence tween on the three closing panels now
   animates `x/y/scale` transforms instead of `left/top` (layout snapping warning).
4. **Contrast** — `.tracker .dim` ("01 /"…) raised from `rgba(232,238,249,.42)` to `.58` (≥4.5:1).
5. **Step marker wrap** — `1 ·` in the guidance panel wrapped its dot onto a second line; now
   `&nbsp;·` non-breaking.

## Known gaps / weakest points

- **VO is robotic** (flite) — biggest quality risk before submission. Swap in a human or
  production TTS; re-run the mix command in SPEC.md (adelay timings unchanged).
- **Scene 02 chips overlap the plate's own text** ("Good morning, Ayla" / "How are you feeling
  today?") — deliberate density of a HUD, but busy at distance; a future pass could duck the plate
  or reposition chips to empty zones.
- **Closing hold**: `#revealTag` on screen 1.4 s (craft floor for its line ~2.0 s); `#triConnect`
  0.97 s (floor 1.7 s). Kept: 30 s budget; the closing still lands (wordmark holds 27.9–29.6 s).
- **`line_unread` / `first_frame_empty` / `film_silent` craft warnings kept deliberately** — the
  film was asked to open on black and VO carries the words; no score by design.
- **`nested_structure_needs_subcomposition`** lint warnings (11) are the same accepted class as v1.
- Motion between stills was not verified at full speed; seams (10.0 / 19.0 / 26.0 s cuts) were
  checked only as adjacent frames.

## Not done / explicitly out of scope

- No music bed, no sound design (not asked for in this brief).
- No localization; copy is English, matching the screenplay.
- `index-v1.html` intentionally untouched and archived; do not delete.
