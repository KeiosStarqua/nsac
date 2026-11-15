/** JSON.parse an toàn — trả undefined khi hỏng (không throw). */
export function safeJsonParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}
