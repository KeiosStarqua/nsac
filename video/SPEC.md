# SPEC — SKY · 30-Second Product Launch Screenplay — v3

VERSION: 3 (current; render output: `out/sky-launch-30s-v3.mp4`). Composed from the Keios brief
"SKY — 30-Second Product Launch Screenplay · Product Demo · NASA Space Apps · 16:9 · 30 seconds"
(received 2026-11-15). v1 (Isolation / Meet Sky cut) is preserved: composition `index-v1.html`,
spec `SPEC-v1.md`, review `REVIEW-v1.md`.

GOAL:    One AI. Three essential capabilities. Safer space exploration.
         Product-demo energy (Apple-style), not a fictional astronaut film.
OUTPUT:  HyperFrames composition `index-v3.html` → MP4, 1920×1080, 30 fps, 30.000 s (900 frames).
         H.264 + AAC 160 kbps. Voiceover: synthesized locally (ffmpeg libflite, CMU Festvox
         voices — `slt` narrator, `kal` for the astronaut line). Captions carry the VO verbatim.
FLOW:    0–3s Intro · 3–10s 01 / Continuous Monitoring · 10–19s 02 / Intelligent Clinical
         Assistance · 19–26s 03 / Connected Medical Support · 26–30s Closing. Apple-style
         cuts, tracker label top-center per scene.
LOOK:    ground #04070f; product plate stays native; one accent #5eead4 (teal) for CHOICE;
         amber #fbbf24 only for risk. Display: system-ui; micro: mono uppercase with letterspacing.
         Dot-grid stages for the two concept scenes; horizon glow for the ground-link scene.
HONESTY: The app is a demo with SIMULATED fixture telemetry — every screen says so:
         - Scenes 01–02: HUD plate capture + "SIMULATED TELEMETRY" chip; metric callouts are the
           app's fixture values (HR 62 · BP 118/76 · SpO₂ 98% · SLEEP 7h 42m · muscle 32.1 kg).
         - Scene 03: clinical guidance panel is a **concept mock labeled "CLINICAL GUIDANCE —
           SIMULATED"**, framed as orthostatic screen guidance + checklist reference, never as a
           diagnosis; footer: "AI-generated, not a substitute for a physician — not medical diagnosis".
         - Scene 04: flight-surgeon overview is a **concept mock labeled "CONCEPT · SIMULATED"**
           and "CONCEPT — NOT A LIVE SYSTEM"; the ~20-minute delivery is the product's outbox
           delay concept, not a real downlink.
         - Scene 05: closing copy, URL, NASA Space Apps line.
         Nothing on screen claims autonomous medical capability. Crew (Ayla R., Commander, Sol 170)
         is fictional; med-ground character (Dr. Okonkwo) is fixture, not a real person.
SHOTS:   f 0–90    INTRO     black; SKY wordmark materializes with cyan glow 0.2–1.5s; plate
                  (hud-loop-slow.mp4) pushes 1.42→1.02 revealing dashboard 0.35–3.0s;
                  tagline "SKY — ASTRONAUT HEALTH INTELLIGENCE"; VO 0.1s.
         f 90–300   MONITOR   plate push 1.02→1.09; tracker "01 / CONTINUOUS MONITORING" 3.3s;
                  callouts HR (3.8s) · BP (4.3s) · SpO₂ (4.8s) · SLEEP (5.3s) · Body comp
                  32.1 kg muscle (5.7s); amber risk moment: "UNUSUAL TREND — AMBER" chip 6.6s
                  + amber ping 6.7s; VO 3.25s.
         f 300–570  CLINICAL  dot-grid stage; CSS orb (breath 11.0s→); tracker
                  "02 / INTELLIGENT CLINICAL ASSISTANCE"; voice question "Sky, I'm feeling dizzy."
                  (kal) 10.6s; Sky reply 13.2s; guidance panel slides in 14.3s (vitals row,
                  3-step orthostatic screen, REF ISS Medical Checklist · Orthostatic Screen,
                  disclaimer); VO 12.9s.
         f 570–780  SURGEON   dot-grid stage + horizon line; tracker "03 / CONNECTED MEDICAL
                  SUPPORT"; flow Astronaut (AYLA R.) → SKY → Flight Surgeon (DR. OKONKWO),
                  arrows draw 20.3/21.15s, link tags "SKY · ENCRYPTED ~20 MIN DELAY" and
                  "AUTO REPORT TO GROUND"; surgeon overview panel slides in 21.8s (latest check
                  green · amber activity −18% vs baseline · ground report queued ~20 min);
                  concept chip; VO 19.3s.
         f 780–900  CLOSING   three feature panels (01 MONITOR / 02 ASSIST / 03 CONNECT)
                  enter 26.0s, converge into orb bloom 26.75s; black; SKY wordmark +
                  Earth-outline ring + horizon line 27.6s; tagline "SAFER SPACE EXPLORATION,
                  WITH SKY" 28.25s; URL + disclaimer micro 28.6/28.9s; VO 26.6s.
VO:      media/voice/vo-1..6.wav (flite slt) + vo-3.wav (kal, astronaut question);
         mix: vo-mix.m4a at adelay 0.1/3.25/10.6/12.9/19.3/26.6 s, amix normalize=0,
         volume 2.5, loudnorm I=-16 TP=-1.5 LRA=11. Mux onto silent render (see README of this dir).
BANNED:  no score/music (not in brief); no invented readiness number; no capability claims beyond
         the demo; no real-person likeness; no "diagnosis" wording; no NASA imagery in v3
         (v1 used s134e010062 — retired with the v1 cut).
BUILD:   `cp index-v3.html /tmp/hf-v3/index.html && npx hyperframes check` (isolated — the repo
         keeps index-v1.html alongside, and check fails on multiple root compositions otherwise);
         `npx hyperframes render -c index-v3.html --video-frame-format png -q delivery -o out/sky-launch-30s-v3-silent.mp4`;
         `ffmpeg -i out/sky-launch-30s-v3-silent.mp4 -i media/voice/vo-mix.m4a -map 0:v:0 -map 1:a:0 -c:v copy -c:a aac -b:a 160k -movflags +faststart out/sky-launch-30s-v3.mp4`.
QA:      frames 1.5 (intro), 4.5 (callouts), 7.0 (amber), 12.2 (question), 15.6 (guidance),
         20.9 (arrows drawn), 23.4 (surgeon panel), 28.4 (reveal). Render verified h264 1920×1080
         30fps 30.000s; audio AAC 160 kbps.
