import { Link } from "@tanstack/react-router";
import { NotebookPen } from "lucide-react";
import DepthText from "~/shared/react-bits/DepthText/DepthText";
import ShinyText from "~/shared/react-bits/ShinyText/ShinyText";
import type { Copy } from "~/shared/i18n";
import {
  BRAND,
  BRAND_COPY,
  BRAND_NAME,
  BRAND_RING,
  BRAND_TAGLINE,
  NOTEBOOKS_LINK,
  SPACECRAFT_LINK,
} from "~/features/sky-hud/hud-classes";
import { DeviceSwitcher } from "~/features/sky-hud/components/DeviceSwitcher";
import { LanguageSwitcher } from "~/features/sky-hud/components/LanguageSwitcher";
import { MOCK_HEADER, MOCK_HEADER_ACTIONS, MOCK_MISSION } from "../mock-classes";
import { MISSION_DAY } from "../data/fixture";

export interface MockHeaderProps {
  readonly copy: Copy;
  /** Hide the locale chip (default: show it). */
  readonly showLanguageSwitcher?: boolean;
  /** Brand mark activation: reset dialogs/chat and restore the opening line. */
  readonly onBrand: () => void;
  /** Mission chip: open the mission detail (with the change-astronaut action). */
  readonly onMission: () => void;
}

/**
 * The console header: brand mark, `ISS · Day N` mission chip, the Console | Watch, SPACECRAFT
 * and NOTEBOOKS chips, plus the locale switcher. The single console header — `/` renders it through the catalog.
 * `data-hud-header` is the measurement anchor for the floating chat card (`chat-geometry.ts`) — the
 * card is portalled to `document.body` and anchors under the centre column, which starts at the
 * header's bottom edge.
 */
export function MockHeader({ copy, showLanguageSwitcher = true, onBrand, onMission }: MockHeaderProps) {
  return (
    <header className={MOCK_HEADER} data-hud-header="">
      <button className={BRAND} type="button" aria-label={copy.hud.brandAria} onClick={onBrand}>
        <span className={BRAND_RING} aria-hidden="true" />
        <span className={BRAND_COPY}>
          <span className={BRAND_NAME}>
            <DepthText
              text="S K Y"
              fontSize="clamp(20px, 2.2vw, 29px)"
              fontWeight={300}
              layers={10}
              depth={0.5}
              tilt={4}
              autoOrbit={false}
              intro={false}
              shadow={false}
              depthColor="#6fa8d6"
            />
          </span>
          <span className={BRAND_TAGLINE}>
            <ShinyText color="#9bb0c8" shineColor="#d6f2ff" speed={12}>
              {copy.hud.tagline}
            </ShinyText>
          </span>
        </span>
      </button>

      <div className={MOCK_HEADER_ACTIONS}>
        <button
          type="button"
          className={MOCK_MISSION}
          aria-label={copy.hud.missionAria}
          onClick={onMission}
        >
          <span className="block h-[15px] w-[20px] [transform:rotate(-10deg)]" aria-hidden="true">
            <svg viewBox="0 0 44 36" fill="none">
              <path
                d="m18 16 8-2M18 21l8-2M15 8l5 10-5 10M28 6l-5 11 5 11M3 12l11-5 4 6-12 5zM31 14l10-5-3 12-9 4z"
                stroke="currentColor"
                strokeWidth="1.5"
              />
              <path d="M11 8 5 23m31-13-7 17M4 6l7 25m28-24-7 25" stroke="currentColor" strokeWidth="1" />
            </svg>
          </span>
          <span>ISS&nbsp;·&nbsp;Day {MISSION_DAY}</span>
        </button>
        <DeviceSwitcher current="console" />
        {showLanguageSwitcher ? <LanguageSwitcher /> : null}
        <Link to="/spacecraft" className={SPACECRAFT_LINK} aria-label={copy.hud.spacecraftButtonAria}>
          <svg
            viewBox="0 0 48 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <rect x="1.3" y="8" width="13" height="8" rx="1.2" />
            <path d="M5.6 8v8M9.9 8v8" />
            <rect x="33.7" y="8" width="13" height="8" rx="1.2" />
            <path d="M38.1 8v8M42.4 8v8" />
            <rect x="19" y="6" width="10" height="12" rx="1.6" />
            <path d="M24 6V2.6M21.6 2.6h4.8" />
            <circle cx="24" cy="12" r="1.5" />
          </svg>
          <span>{copy.hud.spacecraftButton}</span>
        </Link>
        <Link
          to="/notebooks"
          id="notebooksLink"
          className={NOTEBOOKS_LINK}
          aria-label={copy.hud.notebooksButtonAria}
        >
          <NotebookPen aria-hidden="true" strokeWidth={1.7} />
          <span>{copy.hud.notebooksButton}</span>
        </Link>
      </div>
    </header>
  );
}
