import type { ReactNode } from "react";
import { ORB_REEL, ORB_REEL_CHAT, ORB_STAGE, ORB_ZONE, ORB_ZONE_CHAT, ORB_ZONE_THINKING } from "../mock-classes";

export interface OrbStageProps {
  /** The orb itself (`features/sky-hud/SkyOrb`), injected by the host. */
  readonly orb: ReactNode;
  /**
   * Chat card open: the ball shrinks to a fixed diameter and parks at the top of the column, so the
   * floating card sits under it instead of over it. Transform + width only — the stage keeps its box,
   * so the greeting, grid and insight band never reflow.
   */
  readonly chatOpen?: boolean;
  /** Connecting/thinking: the violet glow behind the orb. */
  readonly thinking?: boolean;
}

/** The centre column's orb stage: free-height box at ≥1101px, orb zone with the glow variant. */
export function OrbStage({ orb, chatOpen = false, thinking = false }: OrbStageProps) {
  return (
    <div className={ORB_STAGE}>
      <div className={chatOpen ? ORB_REEL_CHAT : ORB_REEL}>
        <div className={`${chatOpen ? ORB_ZONE_CHAT : ORB_ZONE}${thinking ? ` ${ORB_ZONE_THINKING}` : ""}`} aria-hidden="true">
          {orb}
        </div>
      </div>
    </div>
  );
}
