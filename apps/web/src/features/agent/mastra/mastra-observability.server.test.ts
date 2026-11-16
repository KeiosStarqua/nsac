import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Mastra } from "@mastra/core/mastra";
import {
  type ObservabilityImports,
  getMastraRoot,
  mastraObservabilityEnabled,
  mastraObservabilityEnv,
  setMastraRootForTests,
  setObservabilityImportForTests,
} from "./mastra-observability.server";
import { createMastraSession, setMastraAgentFactoryForTests } from "./mastra-core.server";
import { resetAgentModelCacheForTests } from "../runtime/agent-model.server";
import { getAgent } from "../agents/registry";

// Tracing is an env-gated, best-effort side channel: these tests never touch the network. The two
// dynamic imports are stubbed, so nothing from @mastra/langfuse or @mastra/observability is
// constructed for real, and the Mastra root is exercised through the same `Observability` seam the
// production build uses.

/** Constructor spies for the two lazily imported packages. */
function stubImports() {
  const calls = { observability: 0, exporter: 0, observabilityConfigs: [] as any[], exporterConfigs: [] as any[] };
  const factory = async () => {
    class FakeExporter {
      constructor(config: any) {
        calls.exporter++;
        calls.exporterConfigs.push(config);
      }
    }
    class FakeObservability {
      constructor(config: any) {
        calls.observability++;
        calls.observabilityConfigs.push(config);
      }
      // The shape Mastra checks for when it accepts an observability entrypoint.
      getDefaultInstance() {
        return undefined;
      }
      setLogger() {}
      setMastraContext() {}
    }
    return { Observability: FakeObservability, LangfuseExporter: FakeExporter } as unknown as ObservabilityImports;
  };
  return { calls, factory };
}

/** A root that records registrations, standing in for the process-wide Mastra instance. */
function fakeRoot(overrides: { addAgent?: (agent: unknown, key?: string) => void } = {}) {
  const added: Array<{ agent: unknown; key?: string }> = [];
  const removed: string[] = [];
  const root = {
    added,
    removed,
    addAgent(agent: unknown, key?: string) {
      added.push({ agent, key });
      overrides.addAgent?.(agent, key);
    },
    removeAgent(key: string) {
      removed.push(key);
      return true;
    },
  };
  return root as unknown as Mastra & { added: typeof added; removed: typeof removed };
}

const CHAT = getAgent("sky-chat");

const ENV_KEYS = [
  "LANGFUSE_PUBLIC_KEY",
  "LANGFUSE_SECRET_KEY",
  "LANGFUSE_BASE_URL",
  "LANGFUSE_ENVIRONMENT",
  "LANGFUSE_RELEASE",
  "npm_package_version",
  "NSAC_GIT_SHA",
  "GIT_SHA",
  "NSAC_LANGFUSE_KEY_PATH",
] as const;

/** A store path that never exists, so the env-only gate stays deterministic. */
const ABSENT_STORE = join(tmpdir(), `nsac-langfuse-absent-${process.pid}.json`);

describe("mastra-observability", () => {
  const prev = new Map<string, string | undefined>();
  let warn: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    for (const key of ENV_KEYS) {
      prev.set(key, process.env[key]);
      delete process.env[key];
    }
    delete process.env.LANGFUSE_PUBLIC_KEY;
    // The Langfuse store can also open the gate (admin panel); keep these tests env-only.
    process.env.NSAC_LANGFUSE_KEY_PATH = ABSENT_STORE;
    setMastraRootForTests(undefined);
    setObservabilityImportForTests(null);
    warn = vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    for (const key of ENV_KEYS) {
      const value = prev.get(key);
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    prev.clear();
    setMastraRootForTests(undefined);
    setObservabilityImportForTests(null);
    setMastraAgentFactoryForTests(null);
    warn.mockRestore();
  });

  function setFullEnv() {
    process.env.LANGFUSE_PUBLIC_KEY = "pk-lf-test";
    process.env.LANGFUSE_SECRET_KEY = "sk-lf-test";
    process.env.LANGFUSE_BASE_URL = "https://langfuse.example.test";
  }

  describe("env gate", () => {
    it("is enabled only when all three variables are non-empty", () => {
      expect(mastraObservabilityEnabled()).toBe(false);
      process.env.LANGFUSE_PUBLIC_KEY = "pk";
      expect(mastraObservabilityEnabled()).toBe(false);
      process.env.LANGFUSE_SECRET_KEY = "sk";
      expect(mastraObservabilityEnabled()).toBe(false);
      process.env.LANGFUSE_BASE_URL = "https://langfuse.example.test";
      expect(mastraObservabilityEnabled()).toBe(true);
    });

    it("treats empty and whitespace-only values as missing", () => {
      setFullEnv();
      process.env.LANGFUSE_BASE_URL = "   ";
      expect(mastraObservabilityEnabled()).toBe(false);
      expect(mastraObservabilityEnv()).toBeNull();
      process.env.LANGFUSE_BASE_URL = "https://langfuse.example.test";
      process.env.LANGFUSE_PUBLIC_KEY = "";
      expect(mastraObservabilityEnabled()).toBe(false);
    });

    it("never invents a base URL (no cloud fallback)", () => {
      process.env.LANGFUSE_PUBLIC_KEY = "pk-lf-test";
      process.env.LANGFUSE_SECRET_KEY = "sk-lf-test";
      expect(mastraObservabilityEnv()).toBeNull();
      setFullEnv();
      expect(mastraObservabilityEnv()?.baseUrl).toBe("https://langfuse.example.test");
    });

    it("falls back to NODE_ENV for the environment and to the package/git version for the release", () => {
      setFullEnv();
      process.env.NODE_ENV = "production";
      expect(mastraObservabilityEnv()).toMatchObject({ environment: "production", release: undefined });
      process.env.LANGFUSE_ENVIRONMENT = "staging";
      process.env.npm_package_version = "0.0.0";
      expect(mastraObservabilityEnv()).toMatchObject({ environment: "staging", release: "0.0.0" });
      process.env.LANGFUSE_RELEASE = "sha-abc123";
      expect(mastraObservabilityEnv()?.release).toBe("sha-abc123");
    });

    it("is enabled by the /admin/keys-stored file when the environment is unset", () => {
      const dir = mkdtempSync(join(tmpdir(), "nsac-mastra-lf-store-"));
      try {
        const storePath = join(dir, "sky-langfuse.json");
        writeFileSync(
          storePath,
          JSON.stringify({
            publicKey: "pk-lf-store",
            secretKey: "sk-lf-store",
            baseUrl: "https://store.langfuse.test",
            savedAt: Date.now(),
          }),
        );
        process.env.NSAC_LANGFUSE_KEY_PATH = storePath;

        expect(mastraObservabilityEnabled()).toBe(true);
        expect(mastraObservabilityEnv()).toMatchObject({
          publicKey: "pk-lf-store",
          secretKey: "sk-lf-store",
          baseUrl: "https://store.langfuse.test",
        });
        // Env still wins as a whole triple once present.
        setFullEnv();
        expect(mastraObservabilityEnv()?.baseUrl).toBe("https://langfuse.example.test");
      } finally {
        process.env.NSAC_LANGFUSE_KEY_PATH = ABSENT_STORE;
        rmSync(dir, { recursive: true, force: true });
      }
    });
  });

  describe("getMastraRoot", () => {
    it("returns null without importing anything when disabled", async () => {
      const { calls, factory } = stubImports();
      let imported = 0;
      setObservabilityImportForTests(async () => {
        imported++;
        return factory();
      });
      expect(await getMastraRoot()).toBeNull();
      expect(imported).toBe(0);
      expect(calls.observability).toBe(0);
    });

    it("builds one root per process and reuses it", async () => {
      setFullEnv();
      process.env.LANGFUSE_ENVIRONMENT = "test-env";
      process.env.LANGFUSE_RELEASE = "test-release";
      const { calls, factory } = stubImports();
      setObservabilityImportForTests(factory);

      const first = await getMastraRoot();
      const second = await getMastraRoot();

      expect(first).toBeTruthy();
      expect(second).toBe(first);
      expect(calls.exporter).toBe(1);
      expect(calls.observability).toBe(1);
      // The exporter carries the env contract: explicit base URL, batch mode, env/release tags.
      expect(calls.exporterConfigs[0]).toMatchObject({
        publicKey: "pk-lf-test",
        secretKey: "sk-lf-test",
        baseUrl: "https://langfuse.example.test",
        realtime: false,
        environment: "test-env",
        release: "test-release",
      });
      // One named instance, service name sky-nsac, one exporter — no storage/platform exporters.
      expect(calls.observabilityConfigs[0].configs.langfuse.serviceName).toBe("sky-nsac");
      expect(calls.observabilityConfigs[0].configs.langfuse.exporters).toHaveLength(1);
    });

    it("resolves null and warns once when the imports fail", async () => {
      setFullEnv();
      setObservabilityImportForTests(async () => {
        throw new Error("cannot resolve @mastra/langfuse");
      });

      expect(await getMastraRoot()).toBeNull();
      expect(await getMastraRoot()).toBeNull();
      expect(warn).toHaveBeenCalledTimes(1);
      const line = String(warn.mock.calls[0]?.[0] ?? "");
      expect(line).toContain("mastra observability disabled");
      // The message never carries a key.
      expect(String(warn.mock.calls[0]?.join(" "))).not.toContain("sk-lf-test");
    });
  });

  describe("createMastraSession registration", () => {
    let dir: string;
    const prevAgentEnv = {
      go: process.env.SKY_OPENCODE_API_KEY,
      goFallback: process.env.OPENCODE_API_KEY,
      goPath: process.env.NSAC_OPENCODE_KEY_PATH,
      provider: process.env.SKY_AGENT_PROVIDER,
      db: process.env.NSAC_SKY_MASTRA_DB,
      backend: process.env.BACKEND_URL,
    };

    beforeEach(() => {
      dir = mkdtempSync(join(tmpdir(), "nsac-mastra-lf-"));
      process.env.SKY_OPENCODE_API_KEY = "test-go-key";
      delete process.env.OPENCODE_API_KEY;
      process.env.NSAC_OPENCODE_KEY_PATH = join(dir, "no-such-key.json");
      process.env.SKY_AGENT_PROVIDER = "opencode-go";
      process.env.NSAC_SKY_MASTRA_DB = join(dir, "sky-mastra.db");
      process.env.BACKEND_URL = "http://127.0.0.1:1";
      resetAgentModelCacheForTests();
      setMastraAgentFactoryForTests(
        () =>
          ({
            stream: async () => {
              const chunks = [{ type: "text-delta", payload: { text: "ok" } }];
              return Object.assign(
                (async function* () {
                  for (const chunk of chunks) yield chunk;
                })(),
                { text: Promise.resolve("ok") },
              );
            },
          }) as never,
      );
    });

    afterEach(() => {
      const restore = (key: string, value: string | undefined) => {
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
      };
      restore("SKY_OPENCODE_API_KEY", prevAgentEnv.go);
      restore("OPENCODE_API_KEY", prevAgentEnv.goFallback);
      restore("NSAC_OPENCODE_KEY_PATH", prevAgentEnv.goPath);
      restore("SKY_AGENT_PROVIDER", prevAgentEnv.provider);
      restore("NSAC_SKY_MASTRA_DB", prevAgentEnv.db);
      restore("BACKEND_URL", prevAgentEnv.backend);
      rmSync(dir, { recursive: true, force: true });
    });

    it("registers the built agent under the profile id", async () => {
      const root = fakeRoot();
      setMastraRootForTests(root);

      const session = await createMastraSession(CHAT);
      await session.prompt("hi", {});

      expect(root.added).toHaveLength(1);
      expect(root.added[0]?.key).toBe("sky-chat");
      // The previous registration under the same key is evicted first: no duplicate-key throw on
      // the second session of a warm process.
      expect(root.removed).toEqual(["sky-chat"]);
    });

    it("does not touch any root when tracing is disabled", async () => {
      const { calls, factory } = stubImports();
      setObservabilityImportForTests(factory);

      const session = await createMastraSession(CHAT);
      await session.prompt("hi", {});

      expect(calls.observability).toBe(0);
      expect(calls.exporter).toBe(0);
    });

    it("keeps the turn working when registration throws", async () => {
      const root = fakeRoot({
        addAgent: () => {
          throw new Error("MASTRA_ADD_AGENT_DUPLICATE_KEY");
        },
      });
      setMastraRootForTests(root);

      const session = await createMastraSession(CHAT);
      await expect(session.prompt("hi", {})).resolves.toBe("ok");
      expect(warn).toHaveBeenCalled();
    });
  });
});
