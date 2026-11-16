// Role labels for the console. The roster (fixture or backend `bio`) carries an English role
// string; the UI renders it in the active locale and falls back to the raw string for a role the
// copy table does not know (backend rows can add new ones).
import type { Copy } from "~/shared/i18n";

const ROLE_KEYS: Readonly<Record<string, keyof Copy["hudMock"]["roles"]>> = {
  Commander: "commander",
  "Flight Engineer": "flightEngineer",
  "Medical Officer": "medicalOfficer",
  "Mission Specialist": "missionSpecialist",
  "Payload Specialist": "payloadSpecialist",
};

export function roleLabel(role: string, roles: Copy["hudMock"]["roles"]): string {
  const key = ROLE_KEYS[role];
  return key ? roles[key] : role;
}
