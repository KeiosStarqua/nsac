# watchOS 26 (Apple Design Resources) — design reference

Reference material for Sky's `/watch` smartwatch HUD, extracted from Apple's
**watchOS 26** Figma Community file on 2026-11-14.

- File: <https://www.figma.com/design/95rE6NIOdWeZFeWDCm7QF4/watchOS-26--Community->
- File key: `95rE6NIOdWeZFeWDCm7QF4`
- Publisher: Apple Inc. (Figma Community) · Copyright © 2026 Apple Inc.
- License page in-file: "License" (`223:56245`) — **Apple Design Resources License Agreement** (Apple Inc., LYL142 06/21/2023)

## License — read before using

The Apple Design Resources are licensed **solely for creating mock-ups of user
interfaces designed for software that runs on Apple's operating systems
(watchOS here)**, in compliance with Apple's Human Interface Guidelines. They
are licensed, not sold. Key restrictions (paraphrased — see the in-file License
page for the controlling text):

- **No redistribution, extraction, or repackaging** of the Template Content
  (artwork, bezels, icons, Activity Rings art) in any work product, website,
  or documentation.
- **No embedding** the resources in software or other products.
- The **SF Compact / SF Symbols** fonts are under a **separate Apple font
  license** — they are not included here and must not be committed to this
  repo.
- Components may not be separated from the bundle and distributed standalone.

Accordingly, this directory contains **only measured facts and factual
reference data** (token values, dimensions, text style metrics, component
names) documented for internal design work, with attribution. It contains
**no Apple artwork, renders, icons, bezel images, or font files**, and none
may be added. If you need the actual kit, use the link above with an Apple
Figma account. If Sky ever ships for real watchOS, install the kit yourself
under the Apple license rather than copying anything from here.

## What's in this folder

| File | Contents |
|---|---|
| `tokens.json` | Color scales (Dark / Light / IC-Dark / IC-Light), label & fill alphas, Liquid Glass parameters, per-watch-size dimensions (40/42/44/46/49 mm), alias resolutions |
| `text-styles.json` | SF Compact Dynamic Type ramp — 90 styles (family, style, size, line height). `AX1/Title 1` appears twice in the source file with different metrics (42/44.5 and 34/41); both are kept, the second as `AX1/Title 1 (alt)` |
| `components.md` | Component/component-set inventory per kit page, variant counts, example list |
| `AGENTS.md` | DOX contract for this folder |

## Resolved

- Figma MCP Starter quota (20 reads/month, View seat) was exhausted mid-pull.
  The user downloaded the file (`var/watchos-26-community.fig`, gitignored,
  **never commit**) and the remaining data was extracted locally with
  `@open-pencil/fig` on 2026-11-14: full component sets/variants per page and
  the two unresolved VARIABLE_ALIAS values (`Slider/Height`,
  `Slider/Button Width` → both alias `List/Min Height`: 43.5/48/48/56/57.5 pt
  at 40/42/44/46/49 mm).
- Still unverified: `get_variable_defs` requires a desktop-app selection, so
  variables were pulled via `use_figma`/`.fig` parse instead. Paint styles
  verified; zero effect styles exist in the file.

## Using this for the Sky `/watch` work

- `apps/web/src/features/sky-hud/components/WatchHud.tsx` and the `/watch`
  route render Sky on a smartwatch frame. Treat the numbers here as the
  watchOS layout envelope (screen sizes, safe areas, list row heights,
  notification metrics) when aligning that mockup.
- Sky Xenobiological UI language (UX.md) stays the visual authority; this
  folder is the watchOS layout/metric reference only — do not import Apple's
  visual identity into Sky's design.
- If `/watch` ever becomes an actual watchOS app mock-up for an Apple-platform
  product, the Apple Design Resources may be used in Figma under the license;
  this repo remains artwork-free.

## Checked

- 2026-11-14: metadata, variable collections (Kit / Colors / Dimensions),
  text/paint/effect styles, libraries added to the file, license and
  getting-started pages, and full component sets/variants per page (via
  MCP and a local `.fig` parse — see "Resolved").
- The `.fig` itself stays in `var/` (gitignored) and must never be
  committed or repackaged — it is Apple Template Content under the Apple
  Design Resources License.
