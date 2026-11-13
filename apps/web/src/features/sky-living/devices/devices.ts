import { capabilitiesFor, DEVICES, DEVICE_ORDER } from "../model/devices";
import type { DeviceClass, DeviceCapabilities } from "../model/devices";

export { capabilitiesFor, DEVICES, DEVICE_ORDER };
export type { DeviceClass, DeviceCapabilities };

export function deviceDensity(device: DeviceClass): DeviceCapabilities["density"] {
  return capabilitiesFor(device).density;
}

export function supportsVoice(device: DeviceClass): boolean {
  return capabilitiesFor(device).voice;
}

export function supportsHaptic(device: DeviceClass): boolean {
  return capabilitiesFor(device).haptic;
}

export function supportsTouch(device: DeviceClass): boolean {
  return capabilitiesFor(device).touch;
}

export function supportsKeyboard(device: DeviceClass): boolean {
  return capabilitiesFor(device).keyboard;
}

export function isSunlightSafe(device: DeviceClass): boolean {
  return capabilitiesFor(device).sunlightSafe;
}

export function isSharedView(device: DeviceClass): boolean {
  return device === "command-display";
}