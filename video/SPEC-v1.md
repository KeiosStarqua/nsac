# SPEC — Sky · Never Alone in Space (30 s launch film) — v1

VERSION: 1 (first script; render output: `out/sky-launch-30s-v1.mp4`). Successor versions get their own `-vN` names.

GOAL:    A viewer who knows nothing about the product finishes the film wanting to tell one person:
         "an astronaut now has a guardian in space." They remember one line.
OUTPUT:  HyperFrames, 1920×1080, 30 fps, 30.0 s (900 frames). Silent; captions carry the voice.
TIME:    6 shots, cuts at 4.5 / 9.5 / 16.0 / 22.5 / 26.5 s. No music.
LOOK:    ground #04070f (cinema black, 3% blue). Product plates stay native (#070b14 family).
         ink #e8eef9 (display), #9aa9c4 (micro). One accent #5eead4 (team teal) — it marks CHOICE,
         not decoration: rings, chips, the orb core. Display face: system-ui 350/650/800;
         tracking -0.02em display, +0.18em micro mono uppercase 15 px.
         Grain: none. Vignette: 8% black, radial, all shots. Depth: plates only, never tilted.
OBJECTS: (1) NASA s134e010062 night horizon photo (ISS silhouette over airglow);
         (2) the Sky orb — CSS: seeded dot field converging + 2 px teal ring + breathing core;
         (3) the real HUD (video plate, vitals callouts by teal ring pings);
         (4) the chat card (video plate, reply bubble overlay reproduces the scripted line only);
         (5) the ISS at 400 km (video plate, NASA/JSC model);
         (6) wordmark S K Y + lockup.
MOTION:  enter expo.out; camera power1.inOut; text rise power4.out; pulses sine.inOut.
         Camera: push 1.00→1.07 isolation; push 1.00→1.05 body; push 1.00→1.06 spacecraft.
         Text rises ≤ 24 px; holds ≥ 1.1 s per clause. No drifting titles after landing.
SHOTS:   f 0–135   ISOLATION   photo push; caption "OUT HERE, / EVERY HEARTBEAT MATTERS." (0.6 s / 1.35 s);
                 hand-off: hard cut to black.
         f 135–300 AWAKENING  72 seeded dots converge; core blooms 189f; "MEET SKY." 191f–245f;
                 subline "YOUR ASTRONAUT'S GUARDIAN." 230f; hand-off: dissolve into HUD plate.
         f 285–480 INTELLIGENCE hud plate push 1.00→1.08; teal ping rings on vitals 10.1/10.8/11.5 s
                 (HR → SpO₂ → health card); caption "AN AI COMPANION THAT /
                 UNDERSTANDS YOUR BODY." from 10.0 s; at 13.6 s cut to body.png 1.05 push,
                 caption persists; SIMULATED TELEMETRY chip bottom-right 9.5–22.5 s.
         f 480–675 CONNECTION   chat plate plays 16.0–21.6 s (untouched speed); YOU caption
                 "SKY, HOW AM I DOING?" 17.0 s; SKY reply bubble rises INSIDE the card at 19.5 s:
                 "Your recovery is on track. You're ready for today."; caret blinks naturally.
         f 675–795 PROMISE      spacecraft plate push 1.00→1.06; caption "BEYOND MONITORING. /
                 TOWARD UNDERSTANDING." 23.2 s / 23.9 s; ISS drifts 400→400 km closer feel.
         f 795–900 REVEAL       black; dot pulses 800f; ring draws 813f–850f; wordmark S K Y 822f;
                 tagline "NEVER ALONE IN SPACE." 846f; micro "nasa.taquangkhoi.com · NASA SPACE APPS 2026" 861f;
                 micro disclaimer "AI-generated, not a substitute for a physician · simulated telemetry" 874f.
BANNED:  no score/VO (silent by design); no invented readiness number; no extra scenes, no KPI grids,
         no feature cards; no title drift; only one accent; NASA photo used as-is (no recolor/claim beyond credit);
         no product UI fabricated — plates are captures of the real app; reply bubble text = scripted demo line,
         always paired with SIMULATED chip; no URL before reveal; no tag heavier than Apache-2.0 disclaimer type.
QA:      frames 045 (photo + text landed), 150 (black cut clean), 210 (dots mid-converge), 250 (core bloomed),
         330 (HUD + first ping ring), 420 (body plate landed), 510 (chat card mid-typing), 590 (reply bubble in),
         720 (ISS held), 850 (ring + wordmark), 880 (all reveal text present), 0/899 (first/last frames).
