# features/spacecraft

## Purpose

ISS test bench for `/spacecraft`: renders the NASA ISS GLB models shipped in `public/models/iss/` so Sky can evaluate its 3D display capability. Display only — no simulation, no data, nothing is measured.

## Ownership

- Owns everything under `features/spacecraft/`. `index.ts` is the public surface: `SpacecraftPage`, nothing else.
- The only code outside the feature that belongs to it is the import, the fixed `Back to HUD` link and the `<SpacecraftPage />` render in `src/routes/spacecraft.tsx`.
- Model assets are `apps/web/public/models/iss/ISS-B.glb` (466 KB, default, needs `KHR_draco_mesh_compression`) and `ISS-stationary.glb` (42.4 MB, no extensions), served locally; sources in `public/models/iss/SOURCES.md`. The draco decoder is vendored in `apps/web/public/draco/` (copied from three's GLTF draco decoder) because drei's default decoder path is a Google CDN, which breaks the offline rule. Never point at a CDN.

## Local Contracts

- `ISS-B.glb` is decoded with `useGLTF(url, "/draco/")`; the full model uses the same call (decoder configured but unused). `useGLTF.clear(url)` is called on retry after a failed load.
- Camera framing is the bounding-sphere fit in `model/framing.ts` (pure, vitest-covered): distance from the narrower of the vertical/horizontal half-angles, camera placed along a fixed direction, near/far derived from the fit distance in `FitCamera`. Recomputed when the model or the viewport aspect changes; OrbitControls target/min/max distance ride the same framing.
- The scene is lazy: `SpacecraftPage` imports `scene/SpacecraftScene` with `lazy()`. The entry chunk must not contain `WebGLRenderer` (checked in the built output; it lives in the shared `OrbitControls-*.js` chunk).
- Fallbacks: no WebGL → readable message; a failed GLB load is caught by `scene/SceneBoundary` (R3F rethrows canvas errors into the DOM), shown with a retry button. Loading progress (`useProgress`) shows as a centred pill with percent.
- ISS-B contains slab geometry at y ≈ +41 (a flat copy/proxy plate, in the file itself — not a loading bug), so the bounding-box fit frames both that plate and the station; the station renders small. Do not edit the asset; report it.
- Styling is CSS modules (`SpacecraftPage.module.css`, `scene/SpacecraftScene.module.css`) on the tokens in `src/styles/global.css`. No i18n — same as `features/body-map/`.

## Work Guidance

- New models go into `SPACECRAFT_MODELS` in `model/models.ts` (keep it pure); draco-required models must use the local `DRACO_DECODER_PATH`.
- Scene behaviour belongs in `scene/`; keep `model/` free of React, three.js and DOM.
- Keep the NASA credit line and the "does not imply NASA endorsement" disclaimer in the footer verbatim.

## Verification

From the repo root: `bun run build` (generates `routeTree.gen`), then `bun run typecheck`, `bun run test` (the `@nsac/backend` failure — `no such table: readings` — is pre-existing on clean HEAD and unrelated). Serve `PORT=3217 bun .output/server/index.mjs` from `apps/web`: `/spacecraft` is 200, both GLBs and `/draco/draco_decoder.wasm` are 200; headless Chromium (see below) shows the lightweight model by default and the full model after clicking its toggle button, with no console errors beyond the harmless `THREE.Clock` deprecation warning.

## Child DOX Index

None.
