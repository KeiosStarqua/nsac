// Header chip: segmented Console | Watch control for the main HUD. Same visual language as the
// neighbouring SPACECRAFT chip (chrome pill, letterspaced caps, blur backdrop). Renders only when
// the watch layout is not forced by a ≤480px viewport — small screens always get the watch.
import { Monitor, Watch } from "lucide-react";
import { useCopy } from "../../../shared/i18n";

export type Device = "console" | "watch";

export interface DeviceSwitcherProps {
  readonly device: Device;
  readonly onChange: (device: Device) => void;
}

export function DeviceSwitcher({ device, onChange }: DeviceSwitcherProps) {
  const copy = useCopy();
  const options: ReadonlyArray<{ id: Device; label: string; Icon: typeof Monitor }> = [
    { id: "console", label: copy.hud.deviceConsole, Icon: Monitor },
    { id: "watch", label: copy.hud.deviceWatch, Icon: Watch },
  ];
  return (
    <div className="device-switcher" role="group" aria-label={copy.hud.deviceSwitcher}>
      {options.map(({ id, label, Icon }) => (
        <button
          key={id}
          type="button"
          className="device-option"
          aria-pressed={device === id}
          onClick={() => onChange(id)}
        >
          <Icon aria-hidden="true" strokeWidth={1.7} />
          <span>{label}</span>
        </button>
      ))}
    </div>
  );
}
