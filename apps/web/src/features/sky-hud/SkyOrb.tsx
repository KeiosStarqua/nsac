import { CrystalizedBall } from "../../shared/react-bits";
import { AGENT_STATE_BALL, type AgentState } from "./agent-state";

/**
 * Ambient Crystalized Ball (React Bits) for the HUD orb zone. The ball renders purely from the
 * caller's `AgentState` — see `agent-state.ts`, the single source of truth every screen derives
 * its signals onto. The component is cursor-reactive; `size` scales the ball's diameter (~335px)
 * inside the enlarged orb zone while the shader's outer halo stays unclipped (`size={0.72}`).
 * `style` stays a required pass-through prop of the vendored component (its @ts-nocheck types demand it).
 */
export function SkyOrb({ state }: { state: AgentState }) {
  const tune = AGENT_STATE_BALL[state];

  return (
    <CrystalizedBall
      theme="dark"
      preset={tune.preset}
      speed={tune.speed}
      glow={tune.glow}
      crackle={tune.crackle}
      sparks={tune.sparks}
      twinkle={tune.twinkle}
      haze={tune.haze}
      particleCount={tune.particleCount}
      size={0.72}
      interactive
      hoverStrength={0.6}
      intro
      style={{ width: "100%", height: "100%" }}
    />
  );
}
