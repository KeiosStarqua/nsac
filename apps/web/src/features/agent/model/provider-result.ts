export function assistantText(message: { content?: unknown }): string {
  const content = (message as any)?.content;
  if (!Array.isArray(content)) return "";
  return content
    .filter((b: any) => b && typeof b === "object" && b.type === "text" && typeof b.text === "string")
    .map((b: any) => b.text)
    .join("");
}

export function isProviderError(message: { stopReason?: unknown }): boolean {
  return (message as any)?.stopReason === "error";
}