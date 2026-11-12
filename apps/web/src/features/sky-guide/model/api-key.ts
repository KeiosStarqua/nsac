// Pure rules for the OpenRouter key (Sky's model composer). The key is write-only:
// it is never returned to the browser, never logged, never put in an error message.

/** Bounds mirror the kirector agent's key rules: long enough to be a key, short enough to be one value. */
export const KEY_MIN_LENGTH = 16;
export const KEY_MAX_LENGTH = 512;

/**
 * Normalizes and validates a key typed into the dialog. Returns the trimmed key, or `null` when it
 * cannot be one: empty, too short, too long, or holding whitespace/control characters.
 */
export function parseOpenRouterKey(raw: string): string | null {
  const key = raw.trim();
  if (key.length < KEY_MIN_LENGTH || key.length > KEY_MAX_LENGTH) return null;
  // A real key is one opaque token; embedded whitespace means a paste of several values or a newline.
  if (/\s/.test(key)) return null;
  return key;
}
