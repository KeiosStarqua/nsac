import { describe, it, expect, vi, beforeEach } from "vitest";
import { shouldRecover, installChunkRecovery } from "./chunk-recovery";

describe("chunk recovery", () => {
  it("recovers when no previous reload", () => {
    expect(shouldRecover(0, 1000)).toBe(true);
  });
  it("does not recover within 15s", () => {
    expect(shouldRecover(1000, 1000 + 14_000)).toBe(false);
  });
  it("recovers after 15s", () => {
    expect(shouldRecover(1000, 1000 + 15_001)).toBe(true);
  });

  it("cleanup removes the listener", () => {
    const listeners: Record<string, Function[]> = {};
    const windowStub: any = {
      addEventListener: vi.fn((type: string, fn: Function) => {
        (listeners[type] ??= []).push(fn);
      }),
      removeEventListener: vi.fn((type: string, fn: Function) => {
        listeners[type] = (listeners[type] ?? []).filter((f) => f !== fn);
      }),
    };
    vi.stubGlobal("window", windowStub);
    const cleanup = installChunkRecovery();
    expect(windowStub.addEventListener).toHaveBeenCalledWith("vite:preloadError", expect.any(Function));
    cleanup();
    expect(windowStub.removeEventListener).toHaveBeenCalledWith("vite:preloadError", expect.any(Function));
    vi.unstubAllGlobals();
  });
});