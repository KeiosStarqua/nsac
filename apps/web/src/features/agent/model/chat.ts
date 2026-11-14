export const MAX_MESSAGE = 500;
export const MAX_REPLY = 2000;
export const MAX_TRANSCRIPT = 40;

export type TranscriptMessage = { role: "user" | "assistant"; text: string; at: string };

export function sanitizeAstronautId(id: string): string | null {
  const t = id.trim().toLowerCase();
  if (!/^[a-z0-9-]+$/.test(t)) return null;
  if (t.length === 0 || t.length > 64) return null;
  return t;
}

export function validateMessage(raw: string): string | null {
  const t = raw.trim();
  if (t.length < 1 || t.length > MAX_MESSAGE) return null;
  return t;
}

export function trimTranscript(messages: TranscriptMessage[]): TranscriptMessage[] {
  if (messages.length <= MAX_TRANSCRIPT) return messages;
  return messages.slice(messages.length - MAX_TRANSCRIPT);
}