// Device embodiments (UX.md §3, §5, §10): the same scene renders differently per device class.
import type { DeviceClass } from "./scene";
export type { DeviceClass } from "./scene";
export interface DeviceCapabilities {
  readonly voice: boolean;
  readonly touch: boolean;
  readonly gaze: boolean;
  readonly keyboard: boolean;
  readonly haptic: boolean;
  readonly audio: boolean;
  readonly density: "micro" | "low" | "medium" | "high";
  readonly color: boolean;
  /** Gloss for the demo: pretend the helmet is readable in sunlight when true. */
  readonly sunlightSafe: boolean;
}

export const DEVICES: Record<DeviceClass, DeviceCapabilities> = {
  "command-display": { voice: true, touch: true, gaze: false, keyboard: false, haptic: false, audio: true, density: "low", color: true, sunlightSafe: false },
  tablet: { voice: true, touch: true, gaze: false, keyboard: true, haptic: true, audio: true, density: "medium", color: true, sunlightSafe: false },
  workstation: { voice: true, touch: true, gaze: false, keyboard: true, haptic: false, audio: true, density: "high", color: true, sunlightSafe: false },
  watch: { voice: false, touch: true, gaze: false, keyboard: false, haptic: true, audio: false, density: "micro", color: false, sunlightSafe: false },
  "ar-headset": { voice: true, touch: false, gaze: true, keyboard: false, haptic: false, audio: true, density: "low", color: true, sunlightSafe: false },
  "eva-hud": { voice: true, touch: false, gaze: false, keyboard: false, haptic: false, audio: true, density: "micro", color: true, sunlightSafe: true },
  "medical-bay": { voice: true, touch: true, gaze: false, keyboard: true, haptic: false, audio: true, density: "high", color: true, sunlightSafe: false },
  "sleep-pod": { voice: true, touch: false, gaze: false, keyboard: false, haptic: true, audio: true, density: "micro", color: true, sunlightSafe: false },
  exercise: { voice: true, touch: true, gaze: false, keyboard: false, haptic: true, audio: true, density: "low", color: true, sunlightSafe: false },
  rover: { voice: true, touch: true, gaze: false, keyboard: false, haptic: false, audio: true, density: "low", color: true, sunlightSafe: true },
  earth: { voice: false, touch: true, gaze: false, keyboard: true, haptic: false, audio: true, density: "high", color: true, sunlightSafe: false },
  audio: { voice: true, touch: false, gaze: false, keyboard: false, haptic: false, audio: true, density: "micro", color: false, sunlightSafe: false },
};

export const DEVICE_ORDER: DeviceClass[] = [
  "tablet",
  "workstation",
  "command-display",
  "watch",
  "ar-headset",
  "eva-hud",
  "medical-bay",
  "exercise",
  "sleep-pod",
  "rover",
  "earth",
  "audio",
];

/** Which primitives a device can render; the safety net is validateScene + validateCapabilities. */
export function capabilitiesFor(device: DeviceClass): DeviceCapabilities {
  return DEVICES[device];
}
