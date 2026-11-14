// Segmented Console | Watch chrome chip — route-aware navigation between `/` (console HUD)
// and `/watch` (full-screen watch HUD). Same visual language as the neighbouring SPACECRAFT
// chip (chrome pill, letterspaced caps, blur backdrop). The parent decides viewport hiding
// (both parents hide it ≤480px — small screens are watch-only).
import { Monitor, Watch } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { useCopy } from "../../../shared/i18n";

export type Device = "console" | "watch";

export interface DeviceSwitcherProps {
  readonly current: Device;
  /** Extra class on the root chip — `/watch` passes `device-switcher-float` to pin it top-right. */
  readonly className?: string;
}

const OPTIONS = [
  { id: "console", to: "/", Icon: Monitor },
  { id: "watch", to: "/watch", Icon: Watch },
] as const;

export function DeviceSwitcher({ current, className }: DeviceSwitcherProps) {
  const copy = useCopy();
  const labels: Record<Device, string> = {
    console: copy.hud.deviceConsole,
    watch: copy.hud.deviceWatch,
  };
  return (
    <div className={className ? `device-switcher ${className}` : "device-switcher"} role="group" aria-label={copy.hud.deviceSwitcher}>
      {OPTIONS.map(({ id, to, Icon }) => (
        <Link
          key={id}
          to={to}
          className="device-option"
          aria-pressed={current === id}
        >
          <Icon aria-hidden="true" strokeWidth={1.7} />
          <span>{labels[id]}</span>
        </Link>
      ))}
    </div>
  );
}
