# SPEC — SKY · 30-Second Product Launch Screenplay — v3

VERSION: 3 (current; outputs: `out/sky-launch-30s-v3.mp4` — music + SFX, no VO (standing rule); `out/sky-launch-30s-v3-silent.mp4` — same picture, no audio). Composed from the Keios brief
"SKY — 30-Second Product Launch Screenplay · Product Demo · NASA Space Apps · 16:9 · 30 seconds"
(received 2026-11-15). v1 (Isolation / Meet Sky cut) is preserved: composition `index-v1.html`,
spec `SPEC-v1.md`, review `REVIEW-v1.md`.

GOAL:    One AI. Three essential capabilities. Safer space exploration.
         Product-demo energy (Apple-style), not a fictional astronaut film.
OUTPUT:  HyperFrames composition `index-v3.html` → MP4, 1920×1080, 30 fps, 30.000 s (900 frames).
         H.264 + AAC. Audio = ElevenLabs music bed + four ElevenLabs SFX. **No voiceover, ever** (rule).
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
           SIMULATED"**: draft workflow only (record symptom, review readings against a
           checklist, prepare a draft for clinician review). Protocol line says placeholder;
           footer says concept only, not medical advice. No diagnosis or treatment claims.
         - Scene 04: flight-surgeon overview is a **concept mock labeled "CONCEPT · SIMULATED"**
           and "CONCEPT — NOT A LIVE SYSTEM"; the ~20-minute delivery is the product's outbox
           delay concept, not a real downlink.
         - Scene 05: closing copy, URL, NASA Space Apps line.
         Nothing on screen claims autonomous medical capability. Crew (Ayla R., Commander, Sol 170)
         is fictional; the ground node is a generic Flight Surgeon (no real-person name).
SHOTS:   f 0–90    INTRO     black; SKY wordmark materializes with cyan glow 0.2–1.5s;
                 current UI plate (hud-mock-loop-10s.mp4, captured from `/`) fades in at
                 scale 1.0 (no crop); tagline "SKY — ASTRONAUT HEALTH INTELLIGENCE"; VO 0.1s.
         f 90–300   MONITOR   plate static at scale 1.0 (crop would cut edge panels); tracker
                   "01 / CONTINUOUS MONITORING" 3.3s; teal pings on HR value (4.0s) and
                   bone-mineral row (5.9s); amber "UNUSUAL TREND — AMBER" 6.6s + amber ping
                   6.7s on the same row; plate runs to 9.75s; VO 3.25s.
         f 300–570  CLINICAL  dot-grid stage; CSS orb (breath 11.0s→); tracker
                  "02 / INTELLIGENT CLINICAL ASSISTANCE"; voice question "Sky, I'm feeling dizzy."
                  (kal) 10.6s; Sky reply 13.2s; guidance panel slides in 14.3s (vitals row,
                  3-step orthostatic screen, REF ISS Medical Checklist · Orthostatic Screen,
                  disclaimer); VO 12.9s.
         f 570–780  SURGEON   dot-grid stage + horizon line; tracker "03 / CONNECTED MEDICAL
                   SUPPORT"; flow Astronaut (AYLA R.) → SKY → Flight Surgeon (generic
                   ground node), arrows draw 20.3/21.15s, link tags "SKY · DEMO OUTBOX
                   ~20 MIN DELAY" and "AUTO REPORT TO GROUND"; overview panel 21.8s (fixture
                   vitals, simulated activity flag, concept report queue); concept chip;
                   VO 19.3s.
         f 780–900  CLOSING   three feature panels (01 MONITOR / 02 ASSIST / 03 CONNECT)
                  enter 26.0s, converge into orb bloom 26.75s; black; SKY wordmark +
                  Earth-outline ring + horizon line 27.6s; tagline "SAFER SPACE EXPLORATION,
                  WITH SKY" 28.25s; URL + disclaimer micro 28.6/28.9s; VO 26.6s.
AUDIO:   No VO (standing rule); flite stems in media/voice/ are archived only. ElevenLabs assets
         in media/audio/ (music bed + whoosh/ping/shimmer/bloom). Mix media/audio/soundtrack-v3-novo.m4a:
         music 30 s (fade 0.6 s in / 1.8 s out, 45% gain);
         whoosh 2.95/9.95/18.95/25.9 s; ping 4.05/5.95/6.75 s; shimmer 14.3/21.8 s; bloom 0.15/27.85 s;
         loudnorm I=-16 TP=-1.5 LRA=11.
BANNED:  no voiceover track (standing rule); no invented readiness number; no capability claims beyond the demo; no real-person
         likeness; no "diagnosis" or treatment wording; no NASA imagery in v3 (v1 used
         s134e010062 — retired with the v1 cut).
BUILD:   Run check in an isolated v3-only copy (repo keeps multiple root compositions). Render
         `npx hyperframes render -c index-v3.html --video-frame-format png -q delivery
         -o out/sky-launch-30s-v3-silent.mp4`, then mux `media/audio/soundtrack-v3-novo.m4a` into
         `out/sky-launch-30s-v3.mp4` (ffmpeg `-c:v copy -c:a aac -b:a 192k -t 30`). Silent output
         stays the HyperFrames render (video-only).
QA:      frames 1.5 (intro), 4.5 (callouts), 7.0 (amber), 12.2 (question), 15.6 (guidance),
         20.9 (arrows drawn), 23.4 (surgeon panel), 28.4 (reveal). Render verified h264 1920×1080
         30fps 30.000s; full version AAC carries VO + music + SFX; silent version has no audio stream.
