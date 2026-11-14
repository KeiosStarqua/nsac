import { describe, expect, it } from "vitest";
import { createSseParser } from "./sse";

function collect(): { frames: string[]; feed: (chunk: string) => void } {
  const frames: string[] = [];
  const feed = createSseParser((data) => frames.push(data));
  return { frames, feed };
}

describe("sse parser", () => {
  it("dispatches complete frames", () => {
    const { frames, feed } = collect();
    feed('data: {"type":"delta","text":"a"}\n\ndata: {"type":"done"}\n\n');
    expect(frames).toEqual(['{"type":"delta","text":"a"}', '{"type":"done"}']);
  });

  it("reassembles a frame split at every single character", () => {
    const { frames, feed } = collect();
    const wire = 'data: {"type":"delta","text":"hello"}\n\ndata: {"type":"done"}\n\n';
    for (const char of wire) feed(char);
    expect(frames).toEqual(['{"type":"delta","text":"hello"}', '{"type":"done"}']);
  });

  it("reassembles a frame split mid-utf8-adjacent payload across byte-sized chunks", () => {
    const { frames, feed } = collect();
    const payload = JSON.stringify({ type: "delta", text: "Ổn định, tiếp tục liều tập." });
    const wire = `data: ${payload}\r\n\r\n`;
    // Split the JSON itself, not just the envelope.
    const cut = Math.floor(wire.length / 2);
    feed(wire.slice(0, cut));
    expect(frames).toHaveLength(0);
    feed(wire.slice(cut));
    expect(frames).toEqual([payload]);
  });

  it("handles several frames in one chunk, CRLF endings and ping comments", () => {
    const { frames, feed } = collect();
    feed(': ping\r\n\r\ndata: {"type":"delta","text":"one"}\r\n\r\n: ping\r\n\r\ndata: {"type":"delta","text":"two"}\r\n\r\ndata: {"type":"done"}\r\n\r\n');
    expect(frames).toEqual(['{"type":"delta","text":"one"}', '{"type":"delta","text":"two"}', '{"type":"done"}']);
  });

  it("joins multiple data lines of one frame with a newline", () => {
    const { frames, feed } = collect();
    feed("data: first\ndata: second\n\n");
    expect(frames).toEqual(["first\nsecond"]);
  });

  it("ignores comments, other fields and blank lines without data", () => {
    const { frames, feed } = collect();
    feed(": keepalive\n\n\n\nevent: message\nid: 7\nretry: 1000\ndata:payload\n\n");
    expect(frames).toEqual(["payload"]);
  });

  it("accepts lone CR line endings and a CRLF split across chunks", () => {
    const { frames, feed } = collect();
    feed("data: a\r\r\r");
    expect(frames).toEqual(["a"]);

    feed("data: b\r");
    expect(frames).toEqual(["a"]);
    feed("\n\r\n");
    expect(frames).toEqual(["a", "b"]);
  });

  it("keeps an unterminated tail buffered", () => {
    const { frames, feed } = collect();
    feed("data: {\"type\":\"delta\"");
    expect(frames).toHaveLength(0);
    feed(",\"text\":\"x\"}\n\n");
    expect(frames).toEqual(['{"type":"delta","text":"x"}']);
  });

  it("strips exactly one leading space from the value", () => {
    const { frames, feed } = collect();
    feed("data:  two spaces\n\n");
    expect(frames).toEqual([" two spaces"]);
  });

  it("does not dispatch a frame that never got a blank line", () => {
    const { frames, feed } = collect();
    feed("data: orphan\n");
    expect(frames).toHaveLength(0);
  });
});
