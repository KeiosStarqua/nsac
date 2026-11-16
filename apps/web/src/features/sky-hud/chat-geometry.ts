/**
 * Chat-open orb + chat-card geometry — one source for the two sides that must line up.
 *
 * The chat card is portalled to `document.body`, so it cannot inherit the console's layout: these
 * values are the contract between the orb zone (`features/hud-gen/mock-classes.ts`,
 * `ORB_ZONE_CHAT`) and the card (`components/SkyChatPanel.tsx`).
 *
 * The orb (vendored Crystalized Ball, `SkyOrb` passes `size={0.72}`) draws a ball of
 * `0.72 × min(zoneW, zoneH)` centred in its square canvas, so a zone of `ORB_BALL_SIZE / 0.72`
 * renders a ball of exactly `ORB_BALL_SIZE` and keeps 19.4% of its box as halo padding above and
 * below the ball. With the zone parked at the top of the centre column (column top = header bottom
 * + the grid's 12px top pad), the ball's bottom edge sits at
 * `headerBottom + 12px + (zone + ball) / 2`, and the card starts 8px under it:
 *
 *   cardTop = headerBottom + 12px + (zone + ball) / 2 + 8px
 *
 * `--hud-header-bottom` is measured from the console header (`[data-hud-header]`) by the panel —
 * the header wraps, so its height is not a constant (88.2px at 1440×900, not 96px).
 *
 * Every Tailwind class below is written as **literal text**: Tailwind v4 detects classes by
 * scanning source files, so a class assembled from interpolated values at runtime is never
 * generated. The plain CSS values next to them exist so tests and comments can spell the geometry.
 */

/** Chat-open ball diameter. Small on purpose: while the chat card is up, the ball is a presence cue, not the focal object (The One Bright Object Rule). */
export const ORB_BALL_SIZE = "clamp(120px,20dvh,180px)";

/** Square zone edge that draws a ball of `ORB_BALL_SIZE` (the ball renders at `size={0.72}`). */
export const ORB_ZONE_CHAT_SIZE = `calc(${ORB_BALL_SIZE}/0.72)`;

/** Zone width class for the chat-open orb (literal — never build Tailwind classes from strings). */
export const ORB_ZONE_CHAT_WIDTH = "min-[721px]:w-[min(100%,calc(clamp(120px,20dvh,180px)/0.72))]";

/** Gap between the ball's bottom edge and the card's top edge (the card covers the halo below it). */
export const CHAT_CARD_GAP = "8px";

/** Card top edge: header bottom + grid top pad + half the zone (the ball centred in it) + the gap. */
export const CHAT_CARD_TOP = `calc(var(--hud-header-bottom,96px)+12px+(${ORB_ZONE_CHAT_SIZE}+${ORB_BALL_SIZE})/2+${CHAT_CARD_GAP})`;

/** Card height: the 600px cap, or what the viewport leaves below the anchor (16px bottom margin). */
export const CHAT_CARD_HEIGHT = `min(600px,calc(100dvh-${CHAT_CARD_TOP}-16px))`;

/**
 * The card's ≥721px anchor classes (literal copies of `CHAT_CARD_TOP` / `CHAT_CARD_HEIGHT` — the
 * test suite locks the two spellings together). Below 721px the card keeps its centred placement.
 */
export const CHAT_CARD_ANCHOR = [
  "min-[721px]:mt-[calc(var(--hud-header-bottom,96px)+12px+(calc(clamp(120px,20dvh,180px)/0.72)+clamp(120px,20dvh,180px))/2+8px)]",
  "min-[721px]:h-[min(600px,calc(100dvh-calc(var(--hud-header-bottom,96px)+12px+(calc(clamp(120px,20dvh,180px)/0.72)+clamp(120px,20dvh,180px))/2+8px)-16px))]",
].join(" ");

/**
 * Horizontal anchor: the card rides the HUD's centre-column axis, which is the viewport centre
 * shifted by whatever the fixed side columns take.
 *
 *  - ≥1101px — grid `[400px · gap 20 · 1fr · gap 20 · 560px]`, `max-w-[1720px] mx-auto`:
 *    axis = viewport centre − 80px in both width regimes (≤1720 and >1720).
 *  - 721–1100px — grid `[400px · gap 16 · 1fr]`: the centre column starts at 432px, so
 *    axis = viewport centre + 208px, clamped so a 560px card never leaves the viewport
 *    (`half viewport − 288px` leaves 8px of breathing room).
 *  - ≤720px — single column: the viewport centre already is the axis (no offset).
 */
export const CHAT_CARD_AXIS = [
  "min-[721px]:max-[1100px]:translate-x-[min(208px,calc(50vw-288px))]",
  "min-[1101px]:-translate-x-[80px]",
].join(" ");
