import { useState } from "react";
import type { Copy } from "~/shared/i18n";
import { format } from "~/shared/i18n";
import {
  AVATAR,
  AVATAR_IMG,
  AVATAR_INITIALS,
  CARD,
  CHANGE_BUTTON,
  CARD_HEAD,
  CARD_TITLE,
  PROFILE_NAME,
  PROFILE_ROLE,
  PROFILE_ROW,
  TAG_ACCENT,
} from "../mock-classes";

export interface ProfileCardProps {
  readonly name: string;
  readonly role: string;
  readonly initials: string;
  /** `/astronauts/<id>.png` — a simulated portrait; initials render if it fails to load. */
  readonly avatarSrc: string;
  readonly copy: Copy["hudMock"];
  /** Existing roster string (`copy.astronaut.change`) — the same handler the picker exposes. */
  readonly changeLabel: string;
  readonly onChange: () => void;
}

/**
 * "Astronaut Profile" card: simulated portrait (initials fallback), roster name + localized role,
 * the "Simulated Telemetry" chip and the existing change-astronaut handler.
 */
export function ProfileCard({
  name,
  role,
  initials,
  avatarSrc,
  copy,
  changeLabel,
  onChange,
}: ProfileCardProps) {
  // A failed PNG (offline, missing file) must never leave a blank circle: initials are the fallback.
  const [avatarFailed, setAvatarFailed] = useState(false);
  return (
    <section className={`${CARD} flex flex-col gap-3`} aria-label={copy.profileTitle} data-testid="mock-profile">
      <div className={CARD_HEAD}>
        <h2 className={CARD_TITLE}>{copy.profileTitle}</h2>
        <span className={TAG_ACCENT} data-testid="simulated-telemetry">
          {copy.profileSimulated}
        </span>
      </div>

      <div className={PROFILE_ROW}>
        <span className={AVATAR}>
          {avatarFailed ? (
            <span className={AVATAR_INITIALS} aria-hidden="true">
              {initials}
            </span>
          ) : (
            <img
              className={AVATAR_IMG}
              src={avatarSrc}
              alt={format(copy.avatarAlt, { name })}
              width={58}
              height={58}
              decoding="async"
              onError={() => setAvatarFailed(true)}
            />
          )}
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-[2px]">
          <p className={PROFILE_NAME}>{name}</p>
          <p className={PROFILE_ROLE}>{role}</p>
          <button type="button" className={CHANGE_BUTTON} onClick={onChange}>
            {changeLabel}
          </button>
        </div>
      </div>
    </section>
  );
}
