import Galaxy from "~/shared/react-bits/Galaxy/Galaxy";
import Particles from "~/shared/react-bits/Particles/Particles";
import type { HudBackground } from "~/features/hud-bg";

export interface HudBackdropProps {
  /** Admin-configured backdrop (`/admin/background`): particles is the default. */
  readonly bg: HudBackground;
  /** `mounted && !reducedMotion` — the vendored scenes skip their intro otherwise. */
  readonly fx: boolean;
}

/**
 * The `/` console backdrop: one absolute, `aria-hidden` layer behind the content. Admin always wins
 * (`?bg=` / `nsac.bg` are retired); both HUD screens render this same layer so the two never drift.
 */
export function HudBackdrop({ bg, fx }: HudBackdropProps) {
  return bg === "galaxy" ? (
    <div className="absolute inset-0 z-0" aria-hidden="true">
      <Galaxy
        starColors={["#ffffff", "#78eaff", "#c8aaff"]}
        twinkleIntensity={0.5}
        glowIntensity={0.5}
        flareIntensity={0.4}
        density={0.85}
        starSpeed={0.5}
        saturation={0.55}
        mouseInteraction={true}
        dpr={1}
        transparent
        opacity={0.9}
        intro={fx}
      />
    </div>
  ) : (
    <div className="absolute inset-0 z-0" aria-hidden="true">
      <Particles
        particleColors={["#ffffff", "#78eaff", "#c8aaff", "#5dbafa"]}
        particleCount={220}
        particleSpread={9}
        speed={0.075}
        particleBaseSize={110}
        sizeRandomness={1}
        cameraDistance={22}
        glow={0.6}
        twinkle={0.55}
        depthOfField={0}
        alphaParticles={false}
        connections={false}
        hoverEffect="parallax"
        particleHoverFactor={0.8}
        clickBurst={false}
        drift="none"
        intro={fx}
        opacity={0.9}
      />
    </div>
  );
}
