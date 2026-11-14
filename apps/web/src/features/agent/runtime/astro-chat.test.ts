import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// astro-chat.server reads NSAC_SKY_SESSIONS_DIR at module load, so each test re-imports
// the module fresh against a tmp dir and never touches real state.
describe("astro-chat.server", () => {
  let dir: string;
  const prevSessions = process.env.NSAC_SKY_SESSIONS_DIR;
  const prevKey = process.env.SKY_OPENROUTER_API_KEY;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "nsac-sky-sessions-"));
    process.env.NSAC_SKY_SESSIONS_DIR = dir;
    process.env.SKY_OPENROUTER_API_KEY = "sk-or-test-fake";
    vi.resetModules();
  });

  afterEach(() => {
    if (prevSessions === undefined) delete process.env.NSAC_SKY_SESSIONS_DIR;
    else process.env.NSAC_SKY_SESSIONS_DIR = prevSessions;
    if (prevKey === undefined) delete process.env.SKY_OPENROUTER_API_KEY;
    else process.env.SKY_OPENROUTER_API_KEY = prevKey;
    rmSync(dir, { recursive: true, force: true });
  });

  it("an empty reply from the session is unavailable and writes no empty assistant message", async () => {
    const mod = await import("./astro-chat.server");
    let disposed = false;
    mod.setChatSessionFactory(async () => ({
      prompt: async () => "",
      dispose: () => {
        disposed = true;
      },
    }));

    const r = await mod.sendChatTurn("ayla-reyes", "hello");

    expect(r.status).toBe("unavailable");
    expect(disposed).toBe(true);
    const onDisk = JSON.parse(readFileSync(join(dir, "ayla-reyes.json"), "utf8")) as {
      messages: { role: string; text: string }[];
    };
    expect(onDisk.messages.filter((m) => m.role === "assistant")).toHaveLength(0);
  });
});
