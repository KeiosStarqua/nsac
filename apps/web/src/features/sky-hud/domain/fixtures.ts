// Screenshot fixture values from the reference frame — clearly labeled, never presented as live telemetry.
// Every display of fixture data in the UI carries the "Simulated data" label.
export const FIXTURE_LABEL = "Simulated data";
const NOW = Date.UTC(2026, 10, 12, 6, 0, 0);
const iso = (offsetMinutes: number) => new Date(NOW - offsetMinutes * 60_000).toISOString();

export const FIXTURE_MODEL = {
  astronautDisplayName: "Minh",
  mission: { stationLabel: "ISS", missionDay: 170, spacecraftTimeIso: iso(0), online: true },
  vitals: {
    heartRate: { kind: "heartRate", value: 62, unit: "bpm", timestamp: iso(12), source: "arm cuff, morning reading", quality: "good", visualState: "normal", baseline: 58, mad: 3, trend: "rising" },
    respiration: { kind: "respiration", value: 16, unit: "br/min", timestamp: iso(15), source: "chest patch", quality: "good", visualState: "normal", baseline: 15, mad: 2, trend: "stable" },
    spo2: { kind: "spo2", value: 98, unit: "%", timestamp: iso(15), source: "pulse oximeter", quality: "good", visualState: "normal", baseline: 97, mad: 1, trend: "stable" },
    sleep: { kind: "sleep", value: 462, unit: "min", timestamp: iso(480), source: "sleep pod", quality: "good", visualState: "normal", baseline: 470, mad: 40, trend: "stable" },
  },
  health: {
    state: "stable",
    summary: "Maintain recovery and readiness",
    assessedAt: iso(12),
    provenance: "Clinician-defined rules + fixture vitals (simulated)",
    bodyRegions: [
      { id: "head", state: "normal" },
      { id: "chest", state: "normal" },
      { id: "leg", state: "advisory" },
      { id: "arm", state: "normal" },
    ],
  },
} as const;
