// The ISS 3D models à Sky ships for the digital-twin test page. Pure data, so
// vitest can check it without three.js.
export interface SpacecraftModel {
  readonly id: string;
  readonly url: string;
  readonly label: string;
}

export const ISS_LIGHT_URL = "/models/iss/ISS-B.glb";
export const ISS_FULL_URL = "/models/iss/ISS-stationary.glb";

export const SPACECRAFT_MODELS: readonly SpacecraftModel[] = [
  { id: "iss-b", url: ISS_LIGHT_URL, label: "ISS — Lightweight (466 KB)" },
  { id: "iss-stationary", url: ISS_FULL_URL, label: "ISS — Full detail (42 MB)" },
];

// The cinematic viewer shows the full-detail model only. The lightweight
// model stays in the catalog (and reachable through loaders) for low-bandwidth
// contexts, but it is not the default and has no UI toggle.
export const DEFAULT_MODEL_ID = "iss-stationary";

// ISS-B.glb requires KHR_draco_mesh_compression. The decoder is served locally
// from public/draco/ (copied from three's bundled GLTF draco decoder) so the
// page keeps working with the network unplugged — drei's default decoder path
// is a Google CDN, which must not be used here.
export const DRACO_DECODER_PATH = "/draco/";
