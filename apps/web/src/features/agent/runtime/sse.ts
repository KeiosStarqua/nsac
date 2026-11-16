/**
 * Incremental Server-Sent Events parser (no IO, client-safe).
 *
 * The chat stream (`/api/chat-stream`) emits one JSON payload per frame, `data: {...}\n\n`, plus
 * `: ok` / `: ping` comments (5 s keepalive; see `turn-stream.ts`). Network chunks split frames at arbitrary byte boundaries, so the
 * parser keeps the unfinished tail and only dispatches on a blank line.
 *
 * Handled per the SSE spec (https://html.spec.whatwg.org/multipage/server-sent-events.html):
 * LF, CRLF and lone CR line endings; several `data:` lines in one event are joined with `\n`;
 * comment lines (`: …`) are ignored; `event:`, `id:` and `retry:` fields are ignored (unused here).
 * A blank line dispatches only when at least one `data:` line was collected.
 */

export type SseParser = (chunk: string) => void;

export function createSseParser(onFrame: (data: string) => void): SseParser {
  let buffer = "";
  let dataLines: string[] = [];

  const handleLine = (line: string) => {
    if (line === "") {
      if (dataLines.length === 0) return;
      const data = dataLines.join("\n");
      dataLines = [];
      onFrame(data);
      return;
    }
    if (line.startsWith(":")) return; // comment / keepalive
    const colon = line.indexOf(":");
    const field = colon === -1 ? line : line.slice(0, colon);
    if (field !== "data") return;
    let value = colon === -1 ? "" : line.slice(colon + 1);
    if (value.startsWith(" ")) value = value.slice(1);
    dataLines.push(value);
  };

  return (chunk: string) => {
    buffer += chunk;
    let index = 0;
    while (index < buffer.length) {
      const lf = buffer.indexOf("\n", index);
      const cr = buffer.indexOf("\r", index);
      let end: number;
      let next: number;
      if (cr !== -1 && (lf === -1 || cr < lf)) {
        end = cr;
        next = cr + 1;
        // A trailing CR may be the first half of a CRLF split across chunks: wait for the rest.
        if (next >= buffer.length) break;
        if (buffer[next] === "\n") next += 1;
      } else if (lf !== -1) {
        end = lf;
        next = lf + 1;
      } else {
        break;
      }
      const line = buffer.slice(index, end);
      index = next;
      handleLine(line);
    }
    buffer = buffer.slice(index);
  };
}
