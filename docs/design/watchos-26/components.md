# watchOS 26 — component inventory

Extracted from Figma MCP (2026-11-14) and from a local parse of the user's
downloaded `.fig` (`var/watchos-26-community.fig`, gitignored) — Apple Design
Resources may not be redistributed or extracted, so this file lists
**names, counts and variant labels only**. No artwork.

Library subscribed in-file (community): `watchOS 26`
`lk-32bda072ec15e732e76d56aa8bd25314051f296f8519a8d868031b46eaabb5ade1290829d0d7deca926b5388f760e9e94aa76d56bfe2ead33d78adeeeb7d15fb`
(plus iOS/iPadOS 26 & 27, macOS 26 & 27, visionOS 26, Material 3, Simple
Design System, and a team library — not needed for watchOS work).

Component-set detection: `FRAME` with `componentPropDefs` whose children are
`SYMBOL` (variant) nodes. Counts are SYMBOL children of the set frame.

## Component sets (page · set · variants)

| Page | Component set | Variants | Variant labels |
|---|---|---|---|
| Activity Rings | — | 1 loose SYMBOL | (1) |
| Alerts, Action sheets, Errors | Example | 5 | Title only · Title + Description · Description only · Symbol + Description · Title with Close button |
| App Icon | _System Icons | 1 | — |
| App Icon | App Icon | 2 | — |
| Buttons | Button - Pill | 8 | Type=Default/Primary/Secondary/Tertiary/Destructive · Default Floating · Primary Floating · Destructive Floating |
| Buttons | Button - Pay | 2 | Size=Small · Size=Full width |
| Buttons | Button - Circular | 4 | Type=Default · Type=Primary · Type=Primary Floating · Type=Default Floating |
| Lists | Item | 5 | Text=Default · Subtitle + Title · Label + Subtitle · Label + Symbol · 3-Line Label + Symbol |
| Lists | Item - Source List | 2 | — |
| Lists | Item - Carousel | 4 | — |
| Navigation Bars | Navigation Bar | 9 | Type=Modal - Text Buttons · Modal - Text Confirm Button · Modal - 1 Control · Modal - Default · Child - Status + Title · Center Aligned · Status + Large Title · Status + Title · Status Bar |
| Notifications | — | 3 loose SYMBOLs | Banner · Short Look · Long Look (example frames on Examples page) |
| Pickers | _Wheels | 2 | State=Default · State=Focused |
| Pickers | Picker | 13 | Values=1–3 · mixed widths · Selected=1/2/3/None |
| Pickers | _Edit Label | 1 loose | — |
| Progress Indicators | Progress Indicator | 3 | Size=Small (Status Bar) · Medium (Table Row) · Large (Content Area) |
| Progress Indicators | _Spinner | 1 loose | — |
| Scrollbar and Tabs | Scrollbar | 9 | Scroll View Height=400/300/200% · Position=1..N |
| Scrollbar and Tabs | Tabs | 9 | Pages=2..4 · Position=1..N |
| Sliders | Slider | 36 | Type=Segmented/Continuous · Stops=3–6 · Value=1..N |
| Smart Stack (Widgets) | Smart-Stack | 5 | Size=40/42/44/46/49mm |
| Smart Stack (Widgets) | Widgets Layout Guide | 60 | Type=Chart/Accessory Widget Group/Label Group/Label Group with Icon/Label Group with Bar/Progress View/Labeled Content/Gauge/Label Group Double/Combo/Progress View with|without Current Value × Size=40–49mm |
| Smart Stack (Widgets) | Widgets | 60 | same type matrix × Size=40–49mm, plus Progress View - Control with|without Current Value |
| Smart Stack (Widgets) | Background | 3 | Style=Over Dark Background · Solid Color · Gradient |
| Toggles | Toggle | 2 | State=On · State=Off |
| Colors and Materials | _Swatch | 4 | Type=Label/Color × Mode=Dark/Light |
| Colors and Materials | loose: _Swatch Grid · _Swatch - Light and Dark · _Swatch - Light and Dark - Vibrant | — | — |
| Layout Grid | loose: Display-Mask-{40..49}mm · Grid/{40..49}mm/{Foundation,Dial-based,Infographic,List,Three Bottom Buttons,Pinned Pill Button} | — | — |
| Product Bezels | Bezels | 5 | Bezel Size=40/42/44/46/49mm |
| Text Styles and Dynamic Type | none (spec page, Dynamic Type tables) | — | see `text-styles.json` |

## Examples page layout (`0:3329`, symbols at y=0 / y=-770)

### Row y=0 (205×251 unless noted)

| Node ID | Name |
|---|---|
| 6556:11990 | Example/Smart Stack (Widgets) |
| 6556:10825 | Example/Toggles |
| 6556:10827 | Example/Sliders |
| 6556:10828 | Example/Scrollbars |
| 6556:10247 | Example/Page Controls |
| 6512:5819 | Example/Navigation Bars |
| 6511:3286 | Example/Buttons |
| 6504:3319 | Example/Alerts |
| 6511:3020 | Examples/Action Sheets |

### Row y=-150 (containers, 550 tall)

| Frame ID | Name | Children |
|---|---|---|
| 6556:11779 | Example/Progress Indicators | Type=Content Area (6556:11780), Type=Inline Table Row (6556:10829) |
| 6556:12385 | Example/Pickers (6750,-150, 1300×550) | Wheels=1 (6556:10826), Wheels=2 (6556:12384), Wheels=3 (6556:12405), Wheels=3 Mixed Widths (6556:12400) |
| 6556:7412 | Example/Notifications (1000×550) | Type=Banner (6556:7430), Type=Short Look (6556:7422), Type=Long Look (6556:7440) |
| 6512:4247 | Example/Lists (1320×550) | Type=Grouped List Items (6512:4242), Type=Colorful (6512:4243), Type=Menu (6512:4245), Type=Workout (6512:4246) |
| 6512:3581 | Example/Errors (1630×550) | Type=Title only (6512:3576), Type=Title + Description (6512:3577), Type=Description only (6512:3578), Type=Symbol + Description (6512:3579), Type=Title with Close button (6512:3580) |

### Row y=-770 (162×197)

- `8584:673` Example/Alerts
- `8584:645` Examples/Action Sheets

## Extraction notes

- MCP pull (2026-11-14): pages list, Kit/Colors/Dimensions variables,
  text/paint/effect styles, libraries, Examples canvas metadata, component
  sets for Activity Rings, Alerts, App Icon, Buttons, Lists, Navigation Bars,
  Notifications, and variant labels above.
- Local `.fig` parse (2026-11-14): per-page SYMBOL/set inventory for Pickers,
  Progress Indicators, Scrollbar and Tabs, Sliders, Smart Stack (Widgets),
  Toggles, Colors and Materials, Layout Grid, Product Bezels; resolution of
  `Slider/Height` / `Slider/Button Width` aliases to `List/Min Height`
  (43.5 / 48 / 48 / 56 / 57.5 pt across 40/42/44/46/49 mm) — see
  `tokens.json` → `aliasNotes`.
- MCP tool budget: exhausted (Starter plan, View seat — 20 reads/month). Do
  not re-request from MCP until the monthly quota resets.
