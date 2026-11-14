/**
 * Benchmark / kiểm chứng streaming cho /spacecraft bằng headless Chromium + CDP.
 *
 * Kịch bản:
 *   (a) cold load  — bytes đi qua mạng tới khi ISS-B (overview) tải xong
 *   (b) full detail — tổng bytes tới khi toàn bộ part streamed xong (shared textures 1 lần)
 *   (c) zoom        — dolly vào Destiny-ish bằng mouse wheel; bytes MỚI phát sinh
 *                     sau khi đã full-detail (kỳ vọng ≈ 0: mọi thứ đã ở cache)
 *
 * Chạy từ repo root (app đã build + đang serve ở URL bên dưới):
 *   PORT=3219 bun .output/server/index.mjs &
 *   bun scripts/iss/bench-iss.ts --url http://127.0.0.1:3219/spacecraft
 *
 * Chromium chạy software GL (SwiftShader) nên rất chậm so với GPU thật;
 * các con số time-to-* là chặn dưới/không tuyệt đối — bytes mới là con số chắc chắn.
 */
import { spawn, type ChildProcess } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const CHROMIUM = process.env.CHROMIUM_BIN ?? "/home/keios/.nix-profile/bin/chromium";

interface CliOptions {
  url: string;
  keepProfile: boolean;
  screenshotDir: string;
  expectModel: string;
}

function parseArgs(argv: string[]): CliOptions {
  const get = (name: string, fallback: string) => {
    const i = argv.indexOf(`--${name}`);
    return i >= 0 && argv[i + 1] ? argv[i + 1]! : fallback;
  };
  return {
    url: get("url", "http://127.0.0.1:3219/spacecraft"),
    keepProfile: argv.includes("--keep-profile"),
    screenshotDir: get("screenshots", join(tmpdir(), "opencode", "iss-shots")),
    expectModel: get("expect-model", "ISS-B"),
  };
}

interface TrackedRequest {
  url: string;
  wireBytes: number;       // encodedDataLength từ loadingFinished
  finishedAtMs: number;    // Date.now() khi nhận loadingFinished
  resourceType: string;
  status: number;
}

class CDP {
  private ws!: WebSocket;
  private id = 0;
  private pending = new Map<number, { resolve: (v: unknown) => void; reject: (e: Error) => void }>();
  private waiters = new Map<string, Array<() => void>>();
  readonly events: string[] = [];

  async connect(wsUrl: string): Promise<void> {
    this.ws = new WebSocket(wsUrl);
    await new Promise<void>((resolve, reject) => {
      this.ws.onopen = () => resolve();
      this.ws.onerror = () => reject(new Error("WebSocket connect failed"));
    });
    this.ws.onmessage = (msg) => {
      const data = JSON.parse(String(msg.data)) as {
        id?: number;
        method?: string;
        params?: Record<string, unknown>;
        result?: unknown;
        error?: { message: string };
      };
      if (data.id !== undefined) {
        const entry = this.pending.get(data.id);
        if (!entry) return;
        this.pending.delete(data.id);
        if (data.error) entry.reject(new Error(data.error.message));
        else entry.resolve(data.result);
        return;
      }
      if (data.method) this.dispatch(data.method, data.params ?? {});
    };
  }

  on(method: string, handler: (params: Record<string, unknown>) => void): void {
    this.eventHandlers.set(method, [...(this.eventHandlers.get(method) ?? []), handler]);
  }
  private readonly eventHandlers = new Map<string, Array<(params: Record<string, unknown>) => void>>();

  private dispatch(method: string, params: Record<string, unknown>): void {
    for (const handler of this.eventHandlers.get(method) ?? []) handler(params);
    const list = this.waiters.get(method);
    if (list) {
      this.waiters.delete(method);
      for (const fn of list) fn();
    }
  }

  call<T = unknown>(method: string, params: Record<string, unknown> = {}): Promise<T> {
    const id = ++this.id;
    return new Promise<T>((resolve, reject) => {
      this.pending.set(id, { resolve: resolve as (v: unknown) => void, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  async waitFor(method: string, timeoutMs: number): Promise<void> {
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => {
        const list = this.waiters.get(method) ?? [];
        this.waiters.set(method, list.filter((fn) => fn !== done));
        reject(new Error(`timeout waiting for ${method}`));
      }, timeoutMs);
      const done = () => {
        clearTimeout(timer);
        resolve();
      };
      this.waiters.set(method, [...(this.waiters.get(method) ?? []), done]);
    });
  }

  close(): void {
    try {
      this.ws.close();
    } catch {
      // already closed
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function launchChromium(profileDir: string): Promise<{ child: ChildProcess; wsEndpoint: string }> {
  const child = spawn(
    CHROMIUM,
    [
      "--headless=new",
      "--remote-debugging-port=0",
      `--user-data-dir=${profileDir}`,
      "--no-sandbox",
      "--disable-dev-shm-usage",
      "--enable-unsafe-swiftshader",
      "--use-angle=swiftshader",
      "--hide-scrollbars",
      "--mute-audio",
      "--window-size=1672,941",
      "--force-device-scale-factor=1",
      "about:blank",
    ],
    { stdio: ["ignore", "pipe", "pipe"] },
  );
  child.stderr?.on("data", () => {});
  // Wait for DevToolsActivePort file (chromium writes it once the browser socket is up)
  const portFile = join(profileDir, "DevToolsActivePort");
  for (let i = 0; i < 120; i++) {
    try {
      const lines = readFileSync(portFile, "utf8").trim().split("\n");
      const port = Number(lines[0]);
      if (port > 0) {
        const res = await fetch(`http://127.0.0.1:${port}/json/version`);
        const info = (await res.json()) as { webSocketDebuggerUrl: string };
        return { child, wsEndpoint: info.webSocketDebuggerUrl };
      }
    } catch {
      await sleep(250);
    }
  }
  child.kill("SIGKILL");
  throw new Error("Chromium did not start its DevTools socket in time");
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  mkdirSync(options.screenshotDir, { recursive: true });
  const profileDir = mkdtempSync(join(tmpdir(), "iss-bench-profile-"));
  console.log(`Profile: ${profileDir}`);

  const { child, wsEndpoint } = await launchChromium(profileDir);
  console.log(`Chromium up: ${wsEndpoint}`);

  const browser = new CDP();
  await browser.connect(wsEndpoint);
  const { targetId } = await browser.call<{ targetId: string }>("Target.createTarget", {
    url: "about:blank",
  });
  browser.close();

  // Open a dedicated WebSocket to the page target via the HTTP endpoint.
  const port = new URL(wsEndpoint.replace("ws://", "http://")).port;
  const list = (await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()) as Array<{
    id: string;
    type: string;
    url: string;
    webSocketDebuggerUrl?: string;
  }>;
  const pageEntry = list.find((t) => t.type === "page" && t.id === targetId) ?? list.find((t) => t.type === "page");
  if (!pageEntry?.webSocketDebuggerUrl) throw new Error("page websocket not found");
  const page = new CDP();
  await page.connect(pageEntry.webSocketDebuggerUrl);

  const consoleErrors: string[] = [];
  const requests = new Map<string, TrackedRequest>();
  const pendingByRequestId = new Map<string, { url: string; resourceType: string; status: number }>();
  let totalWireBytes = 0;
  let navStartMs = Date.now();

  page.on("Runtime.consoleAPICalled", (params) => {
    const type = String(params.type ?? "");
    if (process.env.BENCH_ALL_CONSOLE) {
      const args = (params.args ?? []) as Array<{ value?: unknown; description?: string }>;
      // devalue() keeps object details: print raw params for [iss] lines
      if (type === "debug" && args.some((a) => String(a.value).includes("[iss]"))) {
        console.log("[console.debug]", JSON.stringify(params.args));
      } else {
        console.log(`[console.${type}]`, args.map((a) => a.description ?? String(a.value)).join(" "));
      }
    }
    if (type === "error" || type === "assert") {
      const args = (params.args ?? []) as Array<{ value?: unknown; description?: string }>;
      consoleErrors.push(args.map((a) => a.description ?? String(a.value)).join(" "));
    }
  });
  page.on("Runtime.exceptionThrown", (params) => {
    const details = params.exceptionDetails as { text?: string } | undefined;
    consoleErrors.push(`exception: ${details?.text ?? "unknown"}`);
  });
  page.on("Log.entryAdded", (params) => {
    const entry = params.entry as { level?: string; text?: string } | undefined;
    if (entry?.level === "error" && entry.text && !entry.text.includes("THREE.Clock")) {
      consoleErrors.push(entry.text);
    }
  });
  page.on("Network.responseReceived", (params) => {
    const requestId = String(params.requestId);
    const response = params.response as { url: string; status: number; mimeType?: string } | undefined;
    if (!response) return;
    pendingByRequestId.set(requestId, {
      url: response.url,
      resourceType: String(params.type ?? ""),
      status: response.status,
    });
  });
  page.on("Network.loadingFinished", (params) => {
    const requestId = String(params.requestId);
    const info = pendingByRequestId.get(requestId);
    if (!info) return;
    const wireBytes = Number(params.encodedDataLength ?? 0);
    const tracked: TrackedRequest = {
      url: info.url,
      wireBytes,
      finishedAtMs: Date.now(),
      resourceType: info.resourceType,
      status: info.status,
    };
    requests.set(requestId, tracked);
    pendingByRequestId.delete(requestId);
    totalWireBytes += wireBytes;
    process.stdout.write(`  ← ${fmtBytes(wireBytes)} ${tracked.resourceType.padEnd(10)} ${shortUrl(tracked.url)}\n`);
  });
  page.on("Network.loadingFailed", (params) => {
    const requestId = String(params.requestId);
    const info = pendingByRequestId.get(requestId);
    consoleErrors.push(`request failed: ${info?.url ?? requestId} (${String(params.errorText ?? "")})`);
    pendingByRequestId.delete(requestId);
  });

  await page.call("Network.enable");
  await page.call("Runtime.enable");
  await page.call("Log.enable");
  await page.call("Page.enable");
  await page.call("Network.setCacheDisabled", { cacheDisabled: true });

  navStartMs = Date.now();
  await page.call("Page.navigate", { url: options.url });
  console.log(`Navigated to ${options.url}`);

  // ---- (a) cold load: chờ ISS-B.glb + draco xong
  const issBRegex = new RegExp(options.expectModel.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "([^a-zA-Z0-9]|$)");
  await waitForRequestMatch(requests, issBRegex, 120_000, `${options.expectModel} to finish`);
  const issB = [...requests.values()].find((r) => issBRegex.test(r.url))!;
  const coldBytes = totalWireBytes;
  const tCold = issB.finishedAtMs - navStartMs;
  console.log(`\n(a) ISS visible-ish: ${tCold} ms, cumulative wire bytes so far: ${fmtBytes(coldBytes)}`);
  await screenshot(page, join(options.screenshotDir, "01-overview.png"));

  // ---- (b) full detail: chờ tất cả parts + textures xong (hoặc timeout)
  const endWait = Date.now() + 90_000;
  const expectedPieces = ["manifest.json", ".gltf", ".bin", ".png", ".jpg"];
  let lastCount = -1;
  let stableRounds = 0;
  while (Date.now() < endWait) {
    await sleep(2500);
    const urls = [...requests.values()].map((r) => r.url);
    const partGltfs = urls.filter((u) => /streamed\/parts\/[^/]+\.gltf$/.test(u)).length;
    const bins = urls.filter((u) => /streamed\/parts\/[^/]+\.bin$/.test(u)).length;
    if (partGltfs === 13 && bins === 13 && lastCount === requests.size) {
      stableRounds += 1;
      if (stableRounds >= 2) break; // ổn định 5s
    } else {
      stableRounds = 0;
    }
    lastCount = requests.size;
  }
  const tFull = Date.now() - navStartMs;
  const fullBytes = totalWireBytes;
  const partUrls = [...requests.values()].filter((r) => /streamed\//.test(r.url));
  const partBytes = partUrls.reduce((sum, r) => sum + r.wireBytes, 0);
  const partCount = partUrls.length;
  console.log(`\n(b) all parts in: ${tFull} ms, cumulative wire bytes: ${fmtBytes(fullBytes)} (streamed assets: ${fmtBytes(partBytes)} across ${partCount} requests)`);
  await screenshot(page, join(options.screenshotDir, "02-full-detail.png"));

  // ---- (c) zoom: dolly in/out với mouse wheel — bytes mới phát sinh phải ≈ 0
  const bytesBeforeZoom = totalWireBytes;
  const requestsBeforeZoom = requests.size;
  const { width, height } = { width: 1672, height: 941 };
  for (const deltaY of [-240, -240, -240, -240, -240, -240, -240, -240]) {
    await page.call("Input.dispatchMouseEvent", {
      type: "mouseWheel",
      x: Math.floor(width / 2),
      y: Math.floor(height / 2),
      deltaX: 0,
      deltaY,
    });
    await sleep(150);
  }
  console.log("\nZoomed in; waiting 6s for any streaming to kick in…");
  await sleep(6000);
  const zoomBytesDelta = totalWireBytes - bytesBeforeZoom;
  const zoomNewRequests = requests.size - requestsBeforeZoom;
  await screenshot(page, join(options.screenshotDir, "03-zoom-in.png"));
  // dolly back out
  for (const deltaY of [240, 240, 240, 240, 240, 240, 240, 240, 240, 240]) {
    await page.call("Input.dispatchMouseEvent", {
      type: "mouseWheel",
      x: Math.floor(width / 2),
      y: Math.floor(height / 2),
      deltaX: 0,
      deltaY,
    });
    await sleep(150);
  }
  await sleep(5000);
  const zoomOutBytesDelta = totalWireBytes - bytesBeforeZoom;
  const zoomOutNewRequests = requests.size - requestsBeforeZoom;
  await screenshot(page, join(options.screenshotDir, "04-zoom-out.png"));

  // ---- report
  console.log("\n================ BENCHMARK REPORT ================");
  console.log(`URL:               ${options.url}`);
  console.log(`(a) cold → ISS first visible: ${tCold} ms; wire bytes to that point: ${fmtBytes(coldBytes)}`);
  console.log(`(b) full detail:              ${tFull} ms; wire bytes total:        ${fmtBytes(fullBytes)}`);
  console.log(`    streamed assets:          ${fmtBytes(partBytes)} in ${partCount} requests`);
  console.log(`    non-streamed (page+over): ${fmtBytes(fullBytes - partBytes)}`);
  console.log(`(c) zoom-in delta:            +${fmtBytes(zoomBytesDelta)} (${zoomNewRequests} requests)`);
  console.log(`    zoom-in+out total delta:  +${fmtBytes(zoomOutBytesDelta)} (${zoomOutNewRequests} requests)`);
  console.log(`Console errors: ${consoleErrors.length === 0 ? "0" : String(consoleErrors.length)}`);
  for (const err of consoleErrors) console.log(`  - ${err}`);

  const expected = ["issB", "fullBytes"];
  void expected;
  console.log("\nTop streamed requests by wire bytes:");
  for (const r of [...requests.values()].filter((r) => /streamed\//.test(r.url)).sort((a, b) => b.wireBytes - a.wireBytes).slice(0, 8)) {
    console.log(`  ${fmtBytes(r.wireBytes).padStart(10)}  ${shortUrl(r.url)}`);
  }

  page.close();
  child.kill("SIGKILL");
  if (!options.keepProfile) rmSync(profileDir, { recursive: true, force: true });
  console.log("\nDone. Screenshots in", options.screenshotDir);
  process.exit(0);
}

function fmtBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

function shortUrl(url: string): string {
  try {
    const u = new URL(url);
    return u.pathname.replace(/^\/models\/iss\//, "models/iss/");
  } catch {
    return url;
  }
}

async function waitForRequestMatch(
  requests: Map<string, TrackedRequest>,
  regex: RegExp,
  timeoutMs: number,
  label: string,
): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if ([...requests.values()].some((r) => regex.test(r.url))) return;
    await sleep(200);
  }
  throw new Error(`timeout waiting for ${label}`);
}

async function screenshot(page: CDP, path: string): Promise<void> {
  const result = await page.call<{ data: string }>("Page.captureScreenshot", { format: "png" });
  writeFileSync(path, Buffer.from(result.data, "base64"));
  console.log(`screenshot → ${path}`);
}

main().catch((error) => {
  console.error("BENCH ERROR:", error);
  process.exit(1);
});
