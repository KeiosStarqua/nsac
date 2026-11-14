# DOX — docs/design/watchos-26

## Purpose

Factual reference for Apple's watchOS 26 Design Resources Figma file, used as
the layout/metric reference for Sky's `/watch` smartwatch HUD. Token values,
dimensions, Dynamic Type metrics, and component inventories only.

## Ownership

Design references. Extracted from Figma on 2026-11-14; update by re-running
the extraction (see README → Gaps) rather than hand-editing values.

## Local Contracts

- **Never commit Apple artwork**: no screenshots/renders/exports of the kit,
  no bezel/icon/Activity-Rings assets, no SF Compact or SF Symbols font files.
  The Apple Design Resources License allows mock-ups only and forbids
  redistribution/extraction; the SF fonts have a separate license.
- Entries must carry source attribution (file key, node, extraction date) and
  stay as facts (numbers, names, sizes) — not derived copies of template art.
- Do not treat this folder as a Sky design-token source of truth; Sky design
  direction lives in `UX.md`. This is watchOS layout reference only.
- Respect `docs/design/watchos-26/README.md` → Gaps; mark unresolved values
  as unresolved instead of guessing.

## Work Guidance

When Sky `/watch` needs a watchOS metric (row height, safe area, notification
geometry), look it up here and cite it in the component comment, same as
medical thresholds carry sources elsewhere in this repo.

## Verification

None yet — data-only reference. If a checker is added later (e.g. JSON schema
validation for `tokens.json`), record it here.

## Child DOX Index

(none)
