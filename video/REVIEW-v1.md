# REVIEW — Sky · Never Alone in Space (30 s launch film) — v1

Version 1 review. Render output: `out/sky-launch-30s-v1.mp4` (25.5 MB, h264, 1920×1080,
30 fps, 900 frames, 30.000 s).

Review pass on the committed composition (`video/index.html` @ `c56eca1`), run after
`npx hyperframes check` came back clean. Frames were inspected as stills
(`snapshot --at 2, 7.5, 11, 14.2, 15.4, 18, 21, 24, 28.5, 28.9, 29.3, 29.9`); the film was
**not** watched back at full speed, and there is no sound to hear.

## Creative calls

- **Silent, captions carry the words** — the person asked for no music and no voiceover. Every
  beat therefore has to read as a still; the caption is the narration, not a subtitle of one.
- **Six shots, no seventh.** The storylines not built: a crew-day arc (morning → sim → sleep)
  and a "ground team" arc (report → 20-minute delay → Earth). Both were possible and both were
  dropped to keep the film inside one promise: the astronaut is guarded.
- **The product is the picture.** All plates are real captures of the app (`/`, `/body`,
  `/spacecraft`) rather than drawn UI; the only synthetic elements on screen are the orb and the
  reveal, which the app also renders itself.
- **Accent discipline.** Teal (`#5eead4`) is used only where the viewer is meant to look: orb
  core, ping rings, the "Sky" label, the wordmark ring. Everything else is ink or micro grey.
- **The film ends on a fade to black** starting at 29.56 s, so the last ~0.4 s is black. Kept: it
  closes the loop opened by the black first frame. Cost: the last frame is empty, so a social
  player that freezes the final frame freezes on nothing.

## What was measured vs. what was only looked at

- Measured: `check` (contract, runtime, layout, motion, contrast, craft) — 0 errors, 0 lint
  warnings; the two remaining craft warnings are deliberate (below). Frame times, beat cuts,
  plate content, safe-box placement, and the render (`1920×1080`, `30 fps`, `900` frames,
  `30.000 s`).
- Only looked at: the motion between stills (eases, seam smoothness), and whether the captions
  land on the beat in motion.
- Not checked by anyone: audio — there is none, by design.

## Weakest shot, and what to change with more time

**00:16–00:22 · CONNECTION (chat).** The card is a captured plate, so the reply can only live as
a caption beside it — the SPEC wanted the reply bubble rising *inside* the card. As a result the
card keeps its empty state ("What should we look at?" / "Sky answers with a short reply you can
act on") while the caption underneath says Sky already answered; a stranger can read that as the
product not answering. With more time: re-capture the chat plate with the reply rendered inside
the card (the app can be driven to that state), then drop the outside "Sky" caption to one line.

Second weakest: 00:10–00:13 INTELLIGENCE. The HUD plate is dense, and the three ping rings are
the only thing saying "look here". With more time: a slightly longer hold on the first ring, and
one shallow push into the vitals column instead of the whole plate.

## Fixed in this pass

| t | was | change | stays |
|---|---|---|---|
| 19.6–22.5 s | "SKY" label sat on top of the first reply line | label lifted (`bottom` 96→152 px), reply block lifted out of the bottom edge (22→56 px), "You" pair raised to match (168/230→196/258 px) | copy, type sizes, timing |
| 16.0–22.5 s | teal "SIMULATED TELEMETRY" chip sat over the card's "Enter to send" footer | second chip instance at top-right for the chat shot; the HUD-shot chip keeps its bottom-right corner | chip wording, colour, 9.5 s start |

## Warnings kept on purpose

- `film_silent` — the film is silent by design (captions are the voice). A music bed would change
  what the person asked for.
- `text_below_floor` — the micro type (NASA credit 14 px, URL/disclaimer 11–14 px) is below the
  28 px phone floor on purpose: it is credit and disclaimer, read at desk size, and it is the
  same micro style the product uses. Enlarging it would put a second focal point on screen.
- `nested_structure_needs_subcomposition` (cleared in the committed revision) — the composition is
  a single flat file with one timeline; splitting it into `compositions/*` scenes would make the
  desktop app's timeline prettier but adds eight files for a 30-second film.

## Render

`npx hyperframes render --video-frame-format png -q delivery -o out/sky-launch-30s-v1.mp4`
→ `1920×1080`, 30 fps, 900 frames, 30.000 s, h264. Output is not committed (`.gitignore`).
