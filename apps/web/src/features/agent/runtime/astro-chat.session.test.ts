import { describe, it, expect } from "vitest";
import { mkdtempSync } from "node:fs";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openOrCreateSessionManager } from "./astro-chat.server";

describe("session manager helper", () => {
  it("creates, persists, and reopens per astronaut", async () => {
    const dir = mkdtempSync(join(tmpdir(), "sess-"));
    const id = "astro-1";
    const target = join(dir, `${id}.jsonl`);
    const first: any = await openOrCreateSessionManager(id, dir);
    const sf = typeof first.getSessionFile === "function" ? first.getSessionFile() : first.sessionFile;
    expect(sf).toBe(target);
    expect(first.isPersisted()).toBe(true);
    first.appendSessionInfo("probe");
    first.appendMessage({ role: "user", content: "probe" });
    expect(existsSync(target)).toBe(true);
    const second: any = await openOrCreateSessionManager(id, dir);
    const sf2 = typeof second.getSessionFile === "function" ? second.getSessionFile() : second.sessionFile;
    expect(sf2).toBe(target);
    expect(second.getEntryCount()).toBeGreaterThanOrEqual(1);

    const id2 = "astro-2";
    const target2 = join(dir, `${id2}.jsonl`);
    const other: any = await openOrCreateSessionManager(id2, dir);
    const sf3 = typeof other.getSessionFile === "function" ? other.getSessionFile() : other.sessionFile;
    expect(sf3).toBe(target2);
    expect(other.getEntryCount()).toBe(0);
  });
});