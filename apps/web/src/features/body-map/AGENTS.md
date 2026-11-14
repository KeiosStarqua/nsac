# features/body-map

## Purpose

The body hologram around the Open Anatomy 3D male model, in two variants. `variant="overlay"` (the default) is the HUD's full-screen glass panel: header, `LayerRail`, `StructureCard`, CC BY 4.0 footer. Keep that render unchanged — it is the HUD modal; today the HUD's `#hologramButton` is a `<Link to="/body">`, so no route mounts the overlay variant. `variant="page"` is the `/body` route (`BodyMapPage`): fullscreen with no chrome — the canvas at `absolute inset-0`, the floating "Body systems" rail and one dim attribution line, `Escape` → `onClose` → HUD. In both variants a click on a structure picks its catalog key and eases the camera to it; the overlay variant additionally shows its catalog facts and — for the heart, lungs and brain — the simulated HUD readings. Showcase only; nothing is measured or diagnosed.

## Ownership

- Owns everything under `features/body-map/`. `index.ts` is the public surface: `BodyMapOverlay` + `BodyMapOverlayProps` and `BodyMapPage`.
- Code outside the feature that belongs to it: `routes/body.tsx` (renders `<BodyMapPage />`, the page variant) and the `#hologramButton` links to `/body` in `features/sky-hud/SkyScreen.tsx` and `features/hud-gen/catalog.tsx`.
- The model asset is `apps/web/public/models/anatomy-male.glb` (~6,250,000 bytes after meshopt simplify), served locally. Never point at the package CDN.

## Local Contracts

- `variant` selects the chrome, never the scene: `"overlay"` renders header + `StructureCard` + footer cards around the canvas; `"page"` (`/body` only) renders no header, no `StructureCard`, no footer, no back link — `role="main"` with an `sr-only` `<h1>` ("Body hologram"), the canvas wrapper at `absolute inset-0` with `rounded-none border-0` and the same `#050c16` radial, `LayerRail` floating (right `clamp(14px,2vw,28px)`, `top-1/2`/`-translate-y-1/2`, z-10; a bottom row under 900px), and one `text-[10px]` dim line carrying `ATTRIBUTION` + the CC BY 4.0 link (bottom-left on desktop, top-left under 900px so the bottom rail cannot cover it). `selected` still reaches `BodyScene`, so a click still eases the camera; `Escape` goes through `onClose` → `navigate({ to: "/" })` in both variants.
- Layer state is `LayerMap = Record<AnatomySystem, boolean>` (`model/layers.ts`), all seven catalog systems including `joints` (hotspot markers, not meshes). `LayerRail` receives `layers` and a `Dispatch<SetStateAction<LayerMap>>`; the last visible layer cannot be switched off. `LayerRail`'s copy and styling are fixed — the page variant only positions the component.
- Mesh names and catalog keys are the same except the skin: the GLB names it `skin_1`, the catalog key is `skin`. Use `structureKeyForMesh` / `meshNameForStructure`; never compare names directly.
- Readings come only from `VITAL_VALUES` in `features/sky-hud/vitals.ts`, mapped by structure key in `model/selection.ts`. Do not type a number into prose; the card always says the data is simulated.
- three.js and the scene are lazy: `BodyMapOverlay` imports `scene/BodyScene` with `lazy()`. The entry chunk must not contain `WebGLRenderer`; check the built `assets/index-*.js`.
- Fallbacks: no WebGL → readable message with `ATTRIBUTION`; a failed GLB (meshopt) load is caught by `scene/SceneBoundary` (R3F rethrows canvas errors into the DOM), shown with the same message plus retry. The scene subtree (preparing state, fallbacks, `<BodyScene>`) is built once and shared by both variants. `ATTRIBUTION` stays verbatim next to the CC BY 4.0 link in the overlay footer and in the page variant's attribution line.
- Styling is Tailwind v4 utilities in `className` (migrated 2026-11-14; `BodyMapOverlay.module.css` and `scene/BodyScene.module.css` are gone, no stylesheet left) on the tokens in `src/styles/global.css`, referenced as `bg-(--surface)`, `text-(--muted)`, `border-(--accent)/22`, `rounded-(--radius)`, `font-(family-name:--mono)`. The catalog colour is the one data-driven value and travels as the `--swatch` custom property, read by `[background-color:var(--swatch,var(--accent))]`.
- The app reset in `src/styles/global.css` is **unlayered**, so it outranks the layered utilities; a utility whose property that reset also declares on the same element keeps the pre-migration rendering with the `!` suffix (`text-[13px]!` on a `<button>`, `tracking-[0.01em]!`/`leading-[1.25]!` on an `<h2>`/`<h3>`, `mt-[6px]!` on a `<p>`, `rounded-[999px]!` where `:focus-visible` would flatten it). `hover:text-(--text)!` is needed for the footer link, whose `a:hover` colour is unlayered.
- Camera maths is pure (`model/framing.ts`); `scene/OrganFocus` eases camera position and the OrbitControls target over 600 ms and jumps instantly under `prefers-reduced-motion`.

## Work Guidance

- Keep `model/` free of React, three.js and DOM so vitest can cover it.
- New structures with a simulated reading go into `VITALS_BY_KEY` in `model/selection.ts`, keyed by catalog key, with the value built from `VITAL_VALUES`.
- New scene behaviour belongs in `scene/`; keep the materials in `model/materials.ts` so the look stays one table.
- Chrome styling is utilities only: no `@apply`, no new CSS files (the feature has none), and every colour/value comes from the `global.css` tokens. Check a styling change by dumping `getComputedStyle` (and `getBoundingClientRect`) per element before and after, at 1672×941 and 390×844; the 3D canvas itself is not deterministic enough to diff.

## Verification

From the repo root (`export PATH="$HOME/.bun/bin:$PATH"`): `bun run build` (generates `routeTree.gen`), then `bun run typecheck`, `bun run test`, then build again if anything changed. Serve `PORT=3999 bun .output/server/index.mjs` from `apps/web`: `/` is 200 and contains `id="hologramButton"`; `/body` is 200, contains the "Body systems" rail and the `ATTRIBUTION` line, and contains no "Back to HUD" and no visible "Body hologram" (only the `sr-only` `<h1>`); `/models/anatomy-male.glb` is 200 (size reduced via gltf-transform simplify+meshopt; update expected Content-Length after build). Check `apps/web/.output/public/assets`: no `WebGLRenderer` in the entry `index-*.js`, and find it in `BodyScene-*.js` (2026-11-14: entry 409,877 B; BodyScene chunk 1,013,082 B).

## Child DOX Index

None.
