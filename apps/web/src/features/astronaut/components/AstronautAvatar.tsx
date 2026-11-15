"use client";

import { useState } from "react";
import { initials } from "../model/astronauts";

/** The least a portrait needs from the roster: the id picks the file, the name is the alt text. */
export interface AstronautAvatarSubject {
  readonly id: string;
  readonly name: string;
}

interface AstronautAvatarProps {
  readonly astronaut: AstronautAvatarSubject;
  /** Box classes (size, ring, glow) — the circle the caller needs. */
  readonly className?: string;
  readonly imgClassName?: string;
  /** Extra classes for the initials fallback (the caller's type scale and colour). */
  readonly initialsClassName?: string;
}

// The box is the whole contract: one round, clipped, self-centered square of whatever size the
// caller asks for, so the portrait and the initials fallback occupy the same pixels.
const BOX = "relative grid place-items-center overflow-hidden rounded-full select-none";
const IMAGE = "size-full rounded-full object-cover";

function join(...parts: Array<string | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

/**
 * One crew portrait, `/astronauts/<id>.png`, clipped to the round box the caller gives it.
 *
 * The file missing or failing to load is not an error state: the same box shows the roster
 * initials, which is what every screen used before portraits existed, so a broken asset can never
 * break a layout. Display only — no interaction, no state beyond "did the image fail".
 *
 * AI-generated art for the fictional crew (no real people); alt text is the crew member's name.
 */
export default function AstronautAvatar({
  astronaut,
  className,
  imgClassName,
  initialsClassName,
}: AstronautAvatarProps) {
  const src = `/astronauts/${astronaut.id}.png`;
  const [failedSrc, setFailedSrc] = useState<string>();

  return (
    <span className={join(BOX, className)}>
      {failedSrc === src ? (
        <span aria-hidden="true" className={initialsClassName}>
          {initials(astronaut.name)}
        </span>
      ) : (
        // biome-ignore lint/performance/noImgElement: a static, locally served roster asset with an initials fallback — no loader needed
        <img
          src={src}
          alt={astronaut.name}
          draggable={false}
          decoding="async"
          onError={() => setFailedSrc(src)}
          className={join(IMAGE, imgClassName)}
        />
      )}
    </span>
  );
}
