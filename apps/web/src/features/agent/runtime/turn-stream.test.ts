import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createTurnStream, TURN_STREAM_KEEPALIVE_MS } from "./turn-stream";
import type { TurnStreamHooks, TurnStreamResult } from "./turn-stream";

// The SSE body of `/api/chat-stream`. These tests pin the contract the red-banner bug needed:
// bytes leave the server immediately (`: ok`), a silent model is bridged by keepalives well under the
// runner's connection idle timeout, the terminal frame is exactly one, and a cancelled reader aborts
// the turn instead of leaving inference running.
function pump(stream: ReadableStream<Uint8Array>) {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  const chunks: { text: string; at: number }[] = [];
  let done = false;
  const task = (async () => {
    for (;;) {
      const next = await reader.read();
      if (next.done) {
        done = true;
        return;
      }
      chunks.push({ text: decoder.decode(next.value), at: Date.now() });
    }
  })();
  return {
    chunks,
    task,
    isDone: () => done,
    texts: () => chunks.map((chunk) => chunk.text),
    cancel: () => reader.cancel(),
  };
}

describe("createTurnStream", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-16T00:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("writes an open comment before the model has produced anything", async () => {
    let release: (result: TurnStreamResult) => void = () => {};
    const stream = createTurnStream({
      run: () => new Promise<TurnStreamResult>((resolve) => { release = resolve; }),
    });
    const out = pump(stream);
    await vi.advanceTimersByTimeAsync(0);

    expect(out.texts()[0]).toBe(": ok\n\n");

    release({ status: "ok", reply: "hi" });
    await vi.advanceTimersByTimeAsync(0);
    expect(out.isDone()).toBe(true);
  });

  it("bridges a silent model with keepalives far below the idle timeout, then completes", async () => {
    // Model silent for 20 s (longer than Bun's measured ~10–12 s idle kill) before its first token.
    const stream = createTurnStream({
      run: ({ onDelta }: TurnStreamHooks) =>
        new Promise<TurnStreamResult>((resolve) => {
          setTimeout(() => {
            onDelta("Hello");
            onDelta(" there");
            resolve({ status: "ok", reply: "Hello there" });
          }, 20_000);
        }),
    });
    const out = pump(stream);
    await vi.advanceTimersByTimeAsync(20_500);

    const texts = out.texts();
    expect(texts[0]).toBe(": ok\n\n");
    expect(texts.filter((text) => text === ": ping\n\n").length).toBeGreaterThanOrEqual(3);
    expect(texts).toContain('data: {"type":"delta","text":"Hello"}\n\n');
    expect(texts).toContain('data: {"type":"delta","text":" there"}\n\n');
    expect(texts.at(-1)).toBe('data: {"type":"done"}\n\n');
    expect(texts.some((text) => text.includes('"type":"error"'))).toBe(false);

    // No silence window ever exceeds the keepalive interval.
    for (let index = 1; index < out.chunks.length; index += 1) {
      const previous = out.chunks[index - 1];
      const current = out.chunks[index];
      if (!previous || !current) continue;
      expect(current.at - previous.at).toBeLessThanOrEqual(TURN_STREAM_KEEPALIVE_MS);
    }
    expect(out.isDone()).toBe(true);
  });

  it("carries chatDock on the ui frame when the harness set one", async () => {
    const stream = createTurnStream({
      run: ({ onUiProgram }: TurnStreamHooks) => {
        onUiProgram("Console { }", "right");
        return Promise.resolve({ status: "ok", reply: "done" });
      },
    });
    const out = pump(stream);
    await vi.advanceTimersByTimeAsync(0);

    expect(out.texts()).toContain('data: {"type":"ui","program":"Console { }","chatDock":"right"}\n\n');
  });

  it("emits the HUD program frame before the terminal frame", async () => {
    const stream = createTurnStream({
      run: ({ onUiProgram }: TurnStreamHooks) => {
        onUiProgram("Console { }");
        return Promise.resolve({ status: "ok", reply: "done" });
      },
    });
    const out = pump(stream);
    await vi.advanceTimersByTimeAsync(0);

    expect(out.texts()).toEqual([
      ": ok\n\n",
      'data: {"type":"ui","program":"Console { }"}\n\n',
      'data: {"type":"delta","text":"done"}\n\n',
      'data: {"type":"done"}\n\n',
    ]);
  });

  it("sends the whole reply as one delta when no delta arrived", async () => {
    const stream = createTurnStream({ run: () => Promise.resolve({ status: "ok", reply: "recovered" }) });
    const out = pump(stream);
    await vi.advanceTimersByTimeAsync(0);
    expect(out.texts()).toContain('data: {"type":"delta","text":"recovered"}\n\n');
    expect(out.texts().at(-1)).toBe('data: {"type":"done"}\n\n');
  });

  it("turns a failed turn into one error frame and no done", async () => {
    const stream = createTurnStream({ run: () => Promise.resolve({ status: "timeout" }) });
    const out = pump(stream);
    await vi.advanceTimersByTimeAsync(0);
    expect(out.texts().at(-1)).toBe('data: {"type":"error","code":"timeout"}\n\n');
    expect(out.texts().some((text) => text.includes('"type":"done"'))).toBe(false);
  });

  it("reports nothing for a cancelled turn (the reader is gone)", async () => {
    const stream = createTurnStream({ run: () => Promise.resolve({ status: "aborted" }) });
    const out = pump(stream);
    await vi.advanceTimersByTimeAsync(0);
    expect(out.texts()).toEqual([": ok\n\n"]);
  });

  it("aborts the turn and stops the heartbeat when the reader cancels", async () => {
    let seen: AbortSignal | undefined;
    const stream = createTurnStream({
      run: (hooks: TurnStreamHooks) =>
        new Promise<TurnStreamResult>((resolve) => {
          seen = hooks.signal;
          hooks.signal.addEventListener("abort", () => resolve({ status: "aborted" }));
        }),
    });
    const out = pump(stream);
    await vi.advanceTimersByTimeAsync(0);
    expect(seen?.aborted).toBe(false);

    const writtenBefore = out.chunks.length;
    await out.cancel();
    await vi.advanceTimersByTimeAsync(0);

    expect(seen?.aborted).toBe(true);
    // No heartbeat is written after the reader went away.
    await vi.advanceTimersByTimeAsync(30_000);
    expect(out.chunks.length).toBe(writtenBefore);
  });
});
