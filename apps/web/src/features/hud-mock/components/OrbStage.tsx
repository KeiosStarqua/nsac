import type { ReactNode } from "react";
import { ORB_STAGE, ORB_STAGE_CHAT, ORB_ZONE, ORB_ZONE_THINKING } from "../mock-classes";

export interface OrbStageProps {
  /** The orb itself (`features/sky-hud/SkyOrb`), injected by the host. */
  readonly orb: ReactNode;
  /** Chat card open: shrink + lift (transform only, the stage keeps its box). */
  readonly chatOpen?: boolean;
  /** Connecting/thinking: the violet glow behind the orb. */
  readonly thinking?: boolean;
}

/** The centre column's orb stage: free-height box at ≥1101px, orb zone with the glow variant. */
export function OrbStage({ orb, chatOpen = false, thinking = false }: OrbStageProps) {
  return (
    <div className={chatOpen ? ORB_STAGE_CHAT : ORB_STAGE}>
      <div className={`${ORB_ZONE}${thinking ? ` ${ORB_ZONE_THINKING}` : ""}`} aria-hidden="true">
        {orb}
      </div>
    </div>
  );
}
