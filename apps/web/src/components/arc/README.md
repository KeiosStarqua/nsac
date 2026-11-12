# Vendored Arc components

This folder contains components of [Arc](https://uiarc.dev), vendored into this
repo as source files — not installed as a package dependency.

- **Licence:** MIT — see the [LICENSE](./LICENSE) file in this folder. The free
  items of Arc are MIT; no Arc Pro source is included here.
- **Upstream:** the Arc library by Elia Kuratli,
  <https://github.com/kuratlielia/arc-library>, published through the
  shadcn-compatible registry at `https://uiarc.dev/r/<name>.json`.
- **How the files were taken:** the registry items `arc-foundation`,
  `arc-motion-tokens`, `card`, `badge`, `alert`, `stepper`, `button`,
  `text-reveal` and `gauge`, each file keeping its upstream path under this
  folder. The `"use client"` directive was dropped because this app is not a
  Next.js app; nothing else was changed.
- **How to update:** fetch the registry item again (for example
  <https://uiarc.dev/r/card.json>), write each file to the target path the item
  lists, and keep this README in step.

Vendored components:

- `card` — card surface
- `badge` — status badge
- `alert` — callout alert
- `stepper` — step indicator
- `button` — button
- `gauge` — radial gauge
- `text-reveal` — animated text reveal
- `foundation.css` — the design tokens
- `motion-tokens.ts` — the shared motion presets

Runtime dependencies these components need (declared in `apps/web/package.json`):
`motion` (MIT), `lucide-react` (ISC), `@radix-ui/react-dialog` (MIT).
