import { CHEST_GLOW, HUMAN_HOLOGRAM } from "../hud-classes";

export interface HoloSvgProps {
  /** Same utility string the card always used; the 3D viewport keeps the box identical. */
  readonly className?: string;
  readonly label?: string;
}

/**
 * The hand-drawn hologram figure the health card shipped with. It is no longer drawn inline in
 * `SkyScreen`: it is the first paint and the fallback of `HologramBody` (no WebGL, scene chunk
 * still loading, or a failed GLB), so the card never shows an empty box. Markup and classes are
 * unchanged from the inline copy.
 */
export function HoloSvg({ className = HUMAN_HOLOGRAM, label = "Glowing holographic human silhouette" }: HoloSvgProps) {
  return (
    <svg className={className} viewBox="0 0 130 236" role="img" aria-label={label}>
      <defs>
        <linearGradient id="bodyFill" x1="0" x2="1"><stop stopColor="#80e9ff" stopOpacity=".16" /><stop offset=".48" stopColor="#e5ffff" stopOpacity=".24" /><stop offset="1" stopColor="#65c9ff" stopOpacity=".12" /></linearGradient>
        <linearGradient id="bodyStroke" x1="0" y1="0" x2=".8" y2="1"><stop stopColor="#d5faff" /><stop offset=".5" stopColor="#67d9ff" /><stop offset="1" stopColor="#71b8ff" /></linearGradient>
        <radialGradient id="chestPulse"><stop stopColor="#ffe0a0" stopOpacity=".9" /><stop offset=".3" stopColor="#ffc27f" stopOpacity=".4" /><stop offset="1" stopColor="#ffbe8f" stopOpacity="0" /></radialGradient>
        <filter id="bodyGlow"><feGaussianBlur stdDeviation="3" /></filter>
      </defs>
      <g>
        <path id="humanShape" d="M66 17c-9 0-13 8-11 18 1 7 3 10 6 12v10c-9 3-20 5-26 13-4 6-7 23-11 43l-7 29c-3 11-1 17 3 18 4 1 6-5 7-13l10-29 5-26-1 39c0 14 1 25 4 37l4 44 2 30c1 6 5 8 9 6l5-43 5-46 6 46 3 43c5 3 9 0 9-7l4-33 3-40 2-39-1-39 6 25 9 29c2 10 5 16 9 13 4-2 3-10 0-19l-8-31c-5-22-6-34-11-39-7-8-17-10-26-13V47c4-4 6-10 6-16 0-10-5-14-15-14Z" fill="url(#bodyFill)" stroke="url(#bodyStroke)" strokeWidth="1.6" strokeLinejoin="round" />
        <path d="M65 57 65 103m-25-11c6 6 16 10 25 9 11 1 21-3 27-9M50 154c8 2 23 2 32 0m-16-51v52" stroke="#a8f7ff" opacity=".4" fill="none" />
        <ellipse cx="66" cy="96" rx="29" ry="38" fill="url(#chestPulse)" className={CHEST_GLOW} />
      </g>
      <use href="#humanShape" fill="none" stroke="#a0eeff" strokeWidth="3.5" opacity=".65" filter="url(#bodyGlow)" />
    </svg>
  );
}
