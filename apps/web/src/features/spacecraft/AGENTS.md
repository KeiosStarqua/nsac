# features/spacecraft

## Purpose

Full-screen cinematic 3D viewer for `/spacecraft`: renders the NASA ISS full-detail GLB drifting in a deep-black universe — Webb "Cosmic Cliffs" backdrop, twin sparse star layers, blue/violet nebula tints, rim/split lighting. Display only — no simulation, no data, nothing is measured, no UI chrome.

## Ownership

- Owns everything under `features/spacecraft/`. `index.ts` is the public surface: `SpacecraftPage`, nothing else.
- The only code outside the feature that belongs to it is the import and the `<SpacecraftPage />` render in `src/routes/spacecraft.tsx` (no links, no overlays; `Escape` navigates to `/`).
- Model assets are `apps/web/public/models/iss/ISS-stationary.glb` (42.4 MB, default and only model shown, no extensions) and `ISS-B.glb` (466 KB, `KHR_draco_mesh_compression`, still in the catalog and loader path, no UI toggle), served locally; sources in `public/models/iss/SOURCES.md`. The draco decoder is vendored in `apps/web/public/draco/` (copied from three's GLTF draco decoder) because drei's default decoder path is a Google CDN, which breaks the offline rule. Never point at a CDN.
- Backdrop asset: `public/spacecraft/cosmic-cliffs-web.jpg` (JWST Cosmic Cliffs, NASA/ESA/CSA/STScI, 3840×2224, darkened to 40%), credit in `public/spacecraft/SOURCES.md`. Rendered at opacity ≈ 0.24 behind the canvas over a deep-black base with blue/violet radial tints and a vignette; it must never wash the scene out of "deep black".

## Local Contracts

- `ISS-stationary.glb` is the default and only rendered model (`DEFAULT_MODEL_ID` in `model/models.ts`); `ISS-B.glb` remains in `SPACECRAFT_MODELS` and loads through `useGLTF(url, DRACO_DECODER_PATH)` for both models. `useGLTF.clear(url)` is called on retry after a failed load. There is no model picker in the DOM.
- Camera framing is the projected-box fit in `model/framing.ts` (pure, vitest-covered): the box's 8 corners are projected onto the view plane perpendicular to the camera direction (`viewBasis`/`projectedExtents`), distance comes from the narrower of the vertical/horizontal half-angles, `padding` 1.18 (≈ 70–85% frame fill) in the scene. Recomputed when the model or the viewport aspect changes; OrbitControls target/min/max distance ride the same framing. (Until 2026-11-14 this was a bounding-sphere fit, which rendered the long truss small.)
- The scene is lazy: `SpacecraftPage` imports `scene/SpacecraftScene` with `lazy()`. The entry chunk must not contain `WebGLRenderer`.
- Starfield: two drei `<Stars/>` layers (140/70 radius, counts 2400/650, saturation 0) inside a group that drifts at ~0.004 rad/s (parallax); `prefers-reduced-motion: reduce` stops the drift and the twinkle (`speed=0`) and disables auto-rotate. The nebula image also stops its slow pan under reduced motion.
- Lighting: dim ambient/hemisphere + cyan-white directional rim from behind-above (intensity 2.4), violet front fill, blue underlight, cool point accent; `RoomEnvironment` PMREM at intensity 0.38 keeps PBR metals readable. There is no bloom post pass — `@react-three/postprocessing` is not a dependency and none may be added; the "bloom" is a CSS radial-gradient halo (`.glow`) behind the transparent canvas. Canvas is transparent (`alpha: true`, clear color 0 alpha); the cosmic-cliffs backdrop and tints live in CSS layers behind it.
- Chrome: none — no title, credit block, toggles, or panels. Loading feedback for the 42 MB model is a bare `NN%` in the bottom-right corner at low opacity (`useProgress`), no pill, no label. `Escape` navigates to `/`. A failed GLB load is caught by `scene/SceneBoundary` (R3F rethrows canvas errors into the DOM) and shows a minimal "Spacecraft unavailable" with a retry button; no WebGL shows the same message.
- NASA credit: intentionally not rendered on the page (per product decision 2026-11-14 — no text overlays). The required attribution stays in `public/spacecraft/SOURCES.md` and `public/models/iss/SOURCES.md`.
- Auto-rotate stays on by default at 0.35 speed (cinematic drift), pauses on hidden tab, and is disabled under `prefers-reduced-motion: reduce`.
- Styling is CSS modules (`SpacecraftPage.module.css`, `scene/SpacecraftScene.module.css`) on the tokens in `src/styles/global.css`. No i18n — same as `features/body-map/`.

## Work Guidance

- New models go into `SPACECRAFT_MODELS` in `model/models.ts` (keep it pure); draco-required models must use the local `DRACO_DECODER_PATH`.
- Scene behaviour belongs in `scene/`; keep `model/` free of React, three.js and DOM.
- Do not add UI panels, controls, or text overlays to this route; if feedback is needed, keep it to the bare-percent pattern.
- Keep `public/spacecraft/SOURCES.md` credit intact if the backdrop asset changes.

## Verification

From the repo root: `bun run build` (generates `routeTree.gen`), then `bun run typecheck`, `bun run test` (the `@nsac/backend` failure — `no such table: readings` — is pre-existing on clean HEAD and unrelated). Serve `PORT=3217 bun .output/server/index.mjs` from `apps/web`: `/spacecraft` is 200, `/models/iss/ISS-stationary.glb` is 200; headless Chromium shows the full-detail model by default with no console errors beyond the harmless `THREE.Clock` deprecation warning. Check `document.documentElement.scrollWidth <= innerWidth + 1` at 1672×941 and 390×844.

## Child DOX Index

None.
