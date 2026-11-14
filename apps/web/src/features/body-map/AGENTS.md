# features/body-map

## Purpose

The SKY HUD's body hologram: a full-screen glass panel around the Open Anatomy 3D male model, opened by the HUD's hologram button (`#hologramButton`). A click on a structure picks its catalog key, shows its catalog facts and — for the heart, lungs and brain — the simulated HUD readings, and eases the camera to it. Showcase only; nothing is measured or diagnosed.

## Ownership

- Owns everything under `features/body-map/`. `index.ts` is the public surface: `BodyMapOverlay` and `BodyMapOverlayProps`, nothing else.
- The only code outside the feature that belongs to it is the one import and `<BodyMapOverlay>` line in `features/sky-hud/SkyScreen.tsx`.
- The model asset is `apps/web/public/models/anatomy-male.glb` (~6,250,000 bytes after meshopt simplify), served locally. Never point at the package CDN.

## Local Contracts

- Layer state is `LayerMap = Record<AnatomySystem, boolean>` (`model/layers.ts`), all seven catalog systems including `joints` (hotspot markers, not meshes). `LayerRail` receives `layers` and a `Dispatch<SetStateAction<LayerMap>>`; the last visible layer cannot be switched off.
- Mesh names and catalog keys are the same except the skin: the GLB names it `skin_1`, the catalog key is `skin`. Use `structureKeyForMesh` / `meshNameForStructure`; never compare names directly.
- Readings come only from `VITAL_VALUES` in `features/sky-hud/vitals.ts`, mapped by structure key in `model/selection.ts`. Do not type a number into prose; the card always says the data is simulated.
- three.js and the scene are lazy: `BodyMapOverlay` imports `scene/BodyScene` with `lazy()`. The entry chunk must not contain `WebGLRenderer`; check the built `assets/index-*.js`.
- Fallbacks: no WebGL → readable message with `ATTRIBUTION`; a failed GLB (meshopt) load is caught by `scene/SceneBoundary` (R3F rethrows canvas errors into the DOM), shown with the same message plus retry. `ATTRIBUTION` stays in the overlay footer verbatim next to the CC BY 4.0 link.
- Styling is CSS modules only (`BodyMapOverlay.module.css`, `scene/BodyScene.module.css`) on the tokens in `src/styles/global.css`. The catalog colour is the one data-driven value and travels as the `--swatch` custom property.
- Camera maths is pure (`model/framing.ts`); `scene/OrganFocus` eases camera position and the OrbitControls target over 600 ms and jumps instantly under `prefers-reduced-motion`.

## Work Guidance

- Keep `model/` free of React, three.js and DOM so vitest can cover it.
- New structures with a simulated reading go into `VITALS_BY_KEY` in `model/selection.ts`, keyed by catalog key, with the value built from `VITAL_VALUES`.
- New scene behaviour belongs in `scene/`; keep the materials in `model/materials.ts` so the look stays one table.

## Verification

From the repo root (`export PATH="$HOME/.bun/bin:$PATH"`): `bun run build` (generates `routeTree.gen`), then `bun run typecheck`, `bun run test`, then build again if anything changed. Serve `PORT=3999 bun .output/server/index.mjs` from `apps/web`: `/` is 200 and contains `id="hologramButton"`; `/models/anatomy-male.glb` is 200 (size reduced via gltf-transform simplify+meshopt; update expected Content-Length after build). Check `apps/web/.output/public/assets`: no `WebGLRenderer` in the entry `index-*.js`, and find it in `BodyScene-*.js` (2026-11-14: entry 409,877 B; BodyScene chunk 1,013,082 B).

## Child DOX Index

None.
