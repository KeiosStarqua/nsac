/**
 * Quản trị ElevenLabs Speech Engine của Sky — engine instance nói chuyện với backend
 * `apps/backend/src/speechEngine.ts` (JWT-gated WS tại `wss://nasa.taquangkhoi.com/speech/ws`
 * → Caddy → `127.0.0.1:3300`). Script này là công cụ vận hành, KHÔNG phải runtime:
 * web/backend không import nó; nó chỉ dùng REST API `/v1/speech-engine`.
 *
 * Chạy từ REPO ROOT bằng bun:  `bun scripts/speech-engine.ts <lệnh> [flags]`
 *
 *   list                              Liệt kê engines trên account (name · id · wsUrl)
 *   get <id>                          Chi tiết một engine
 *   ensure [--name N] [--ws-url U]    Idempotent: tìm theo name (mặc định "sky-nsac-speech-engine"),
 *                                     có rồi in ra, chưa có thì tạo với wsUrl
 *                                     (mặc định wss://nasa.taquangkhoi.com/speech/ws) rồi verify lại.
 *   update <id> [--name N] [--ws-url U]
 *   delete <id>                       Xoá engine (hành động huỷ diệt, không hỏi lại)
 *
 * API key: truyền qua biến môi trường `ELEVENLABS_API_KEY` (KHÔNG truyền qua argv — argv nằm
 * trong `ps` và shell history). Key không bao giờ được in hoặc log; engine id là public
 * instance handle (không phải secret) nên được in để điền vào env `ELEVENLABS_SPEECH_ENGINE_ID`.
 *
 * Sau khi `ensure`, cập nhật env trên box và restart backend:
 *   echo 'ELEVENLABS_SPEECH_ENGINE_ID=<id>' | sudo tee -a /etc/nsac-web/env && sudo systemctl restart nsac-backend
 * JWT verify ở backend dùng `ELEVENLABS_API_KEY` nếu có, không thì fallback key đã lưu qua /admin.
 */
const API = "https://api.elevenlabs.io/v1/speech-engine";
const DEFAULT_NAME = "sky-nsac-speech-engine";
const DEFAULT_WS_URL = "wss://nasa.taquangkhoi.com/speech/ws";

const key = process.env.ELEVENLABS_API_KEY?.trim();
if (!key) {
  console.error("error: đặt ELEVENLABS_API_KEY trong môi trường (không đưa key vào argv)");
  process.exit(1);
}

function flag(args: string[], name: string): string | undefined {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
}

async function call(method: string, path: string, body?: unknown): Promise<{ status: number; json: unknown }> {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { "xi-api-key": key!, "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let json: unknown = text;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    /* giữ raw text để in */
  }
  return { status: res.status, json };
}

/** In JSON đã nằm trong account của operator; bản thân payload không chứa key. */
function print(status: number, json: unknown) {
  console.log(JSON.stringify(json, null, 2));
  if (status >= 400) {
    console.error(`error: HTTP ${status}`);
    process.exit(1);
  }
}

function engineIdOf(e: unknown): string | undefined {
  if (!e || typeof e !== "object") return undefined;
  const o = e as Record<string, unknown>;
  const v = o.speech_engine_id ?? o.speechEngineId ?? o.id;
  return typeof v === "string" ? v : undefined;
}

function engineNameOf(e: unknown): string | undefined {
  if (!e || typeof e !== "object") return undefined;
  const o = e as Record<string, unknown>;
  return typeof o.name === "string" ? o.name : undefined;
}

/** List API trả về shape khác nhau tuỳ bản; tìm mảng engines theo các key quen thuộc. */
function extractEngines(json: unknown): unknown[] {
  if (Array.isArray(json)) return json;
  if (!json || typeof json !== "object") return [];
  const o = json as Record<string, unknown>;
  for (const k of ["speech_engines", "speechEngines", "engines", "data", "items"]) {
    if (Array.isArray(o[k])) return o[k] as unknown[];
  }
  // fallback: mảng đầu tiên trong object
  for (const v of Object.values(o)) {
    if (Array.isArray(v)) return v;
  }
  return [];
}

const [cmd, ...rest] = process.argv.slice(2);

if (cmd === "list") {
  const { status, json } = await call("GET", "?search=&page_size=50");
  const engines = extractEngines(json);
  for (const e of engines) {
    console.log(`${engineIdOf(e) ?? "?"}\t${engineNameOf(e) ?? "?"}\t${JSON.stringify((e as Record<string, unknown>)?.speech_engine ?? (e as Record<string, unknown>)?.ws_url ?? "")}`);
  }
  if (engines.length === 0) console.log("(không tìm thấy engine nào hoặc response rỗng — xem raw:)");
  if (engines.length === 0) print(status, json);
} else if (cmd === "get") {
  const id = rest[0];
  if (!id) { console.error("usage: get <id>"); process.exit(1); }
  const { status, json } = await call("GET", `/${encodeURIComponent(id)}`);
  print(status, json);
} else if (cmd === "ensure") {
  const name = flag(rest, "--name") ?? DEFAULT_NAME;
  const wsUrl = flag(rest, "--ws-url") ?? DEFAULT_WS_URL;
  const { status, json } = await call("GET", `?search=${encodeURIComponent(name)}&page_size=50`);
  if (status >= 400) print(status, json);
  const existing = extractEngines(json).find((e) => engineNameOf(e) === name);
  const existingId = engineIdOf(existing);
  if (existingId) {
    console.log(`exists: ${existingId}\tname=${name}`);
    process.exit(0);
  }
  const created = await call("POST", "", { name, speechEngine: { wsUrl } });
  print(created.status, created.json);
  const id = engineIdOf(created.json);
  if (!id) {
    console.error("error: create thành công nhưng không đọc được engine id từ response (xem ở trên)");
    process.exit(1);
  }
  console.error(`created: ${id}\tname=${name}\twsUrl=${wsUrl}`);
  console.log(id);
} else if (cmd === "update") {
  const id = rest[0];
  if (!id) { console.error("usage: update <id> [--name N] [--ws-url U]"); process.exit(1); }
  const name = flag(rest, "--name");
  const wsUrl = flag(rest, "--ws-url");
  if (!name && !wsUrl) { console.error("cần --name hoặc --ws-url"); process.exit(1); }
  const body: Record<string, unknown> = {};
  if (name) body.name = name;
  if (wsUrl) body.speechEngine = { wsUrl };
  const { status, json } = await call("PATCH", `/${encodeURIComponent(id)}`, body);
  print(status, json);
} else if (cmd === "delete") {
  const id = rest[0];
  if (!id) { console.error("usage: delete <id>"); process.exit(1); }
  const { status, json } = await call("DELETE", `/${encodeURIComponent(id)}`);
  print(status, json);
} else {
  console.error("usage: bun scripts/speech-engine.ts <list|get|ensure|update|delete> [flags]  (xem header file)");
  process.exit(1);
}
