# HARNESSING.md — Agent harness (Pi SDK) của Sky

Cách các agent viết bằng **Pi SDK** (`@earendil-works/pi-coding-agent`, pinned `1.5.2`) chạy,
phối hợp với nhau và dùng tools/skills. Ghi nhận từ code ngày 2026-11-14; đối chiếu với
`apps/web/src/features/agent/` trước khi cập nhật. Đây là tài liệu hiện trạng — tầm nhìn dài hạn
(per-astronaut pairs, broadcast bus, 5 hazard workers) nằm ở `docs/AGENT_BROADCAST.md` và **chưa build**.

## 1. Mental model

```
Route / server function (TanStack Start)
        │  createServerFn handler — server-only
        ▼
features/agent/api/*.functions.ts        (lớp mỏng: validate input, gọi runtime)
        ▼
runtime/*.server.ts                      (điều phối: session cache, queue, timeout, validate)
        ▼
runtime/pi.server.ts                     (Pi SDK boundary — duy nhất chỗ import SDK)
        ▼
@earendil-works/pi-coding-agent          (lazy dynamic import, không nằm trong client bundle)
        ▼
OpenRouter (OpenAI-compatible /v1)       (model chỉnh được qua /admin → backend SQLite)
```

Ba quy tắc xuyên suốt:

1. **Agent = profile + registry.** Thêm agent = một file profile + một dòng registry + một test row.
2. **Pi SDK chỉ bị import server-side** (`import "@tanstack/react-start/server-only"` ở đầu mọi
   `runtime/*.server.ts`; SDK nạp bằng dynamic `import()` bên trong hàm, không ở module top-level).
3. **Phối hợp bằng code deterministic, không bằng LLM routing.** Regex/dispatch chọn agent;
   LLM không tự gọi agent khác. Mọi hành động thật vẫn cần Confirm của phi hành gia.

## 2. Bản đồ code

| Path | Vai trò |
|---|---|
| `agents/types.ts` | Contract `AgentProfile`, `AgentContext`, `OutputContract`, `AgentId` |
| `agents/registry.ts` | `AGENT_REGISTRY`, `getAgent`, `listAgents`, `specialists` |
| `agents/orchestrator.ts` | Profile `sky-orchestrator` + `routeRequest()` (regex handoff) |
| `agents/generative-ui.ts` | Profile `sky-generative-ui` — sinh OpenUI Lang cho panel |
| `agents/hud-composer.ts` | Profile `sky-hud-composer` — composer riêng cho HUD `/?gen=1` |
| `agents/chat.ts` | Profile `sky-chat` — trả lời plain text, voice của Sky |
| `soul/sky.md` + `soul/index.ts` | SOUL dùng chung cho mọi profile (`skySoul`) |
| `agents/surfaces.ts` | `SURFACES` — allow-list component theo từng surface (hiện có `orbit-panel`) |
| `runtime/pi.server.ts` | Tạo Pi SDK session; quản ModelRuntime, auth, resource loader, `tools: []` |
| `runtime/run.server.ts` | `runAgent()` — runner chung: timeout, dispose, map lỗi |
| `runtime/orchestrator.server.ts` | `askSky()` — dispatch 1 chiều orchestrator → specialist |
| `runtime/astro-chat.server.ts` | Chat per-astronaut: transcript, session cache, queue |
| `runtime/hud-compose.server.ts` | HUD composer: program cache, review pipeline |
| `runtime/agent-model.server.ts` | Resolve model hiệu lực (backend → lastGood → env → default) |
| `runtime/openui.server.ts` | `validateProgram()` — cổng validate OpenUI Lang |
| `catalog/library.tsx` | React Bits catalog (REACT_BITS_NAMES — allow-list của generative-ui) |
| `model/chat.ts` | Sanitize id, validate message, trim transcript |
| `model/provider-result.ts` | `assistantText()`, `isProviderError()` — đọc kết quả turn |

## 3. Vòng đời một request

### 3.1 HUD composer (`/?gen=1`, hiện dùng tích cực nhất)

```
composeHud(astronautId, locale)                     [api/hud-compose.functions.ts]
  → sanitize id, validate locale, findAstronaut
  → programCache hit (`id:locale`, TTL 15 phút)?    → trả về cached
  → enqueue theo sessionId (tuần tự hoá mỗi astronaut)
  → getSession: cache TTL 20 phút, tối đa 6 session; model đổi → huỷ, tạo lại
  → session.prompt(instruction)                      (brief theo locale, fact ids, no digits)
  → extractProgram → reviewProgram (allowList HUD_COMPONENT_NAMES, parseHudProgram)
  → rejected? → KHÔNG cache (lần sau gọi lại model)
  → ok? → cache program, trả về cho client — client tự render qua hud-gen catalog
          (preset vẫn là đường render chính; mọi failure ⇒ preset giữ nguyên)
```

### 3.2 Chat với Sky (per-astronaut)

```
sendChatTurn(astronautId, message)                   [api/chat.functions.ts]
  → sanitize id → findAstronaut → validateMessage (1..500 ký tự)
  → thiếu SKY_OPENROUTER_API_KEY → { status: "missing_key" }
  → append user message vào var/sky-sessions/<id>.json (trim 40 message, mode 0600)
  → enqueue theo id (mỗi astronaut một hàng đợi)
  → getSession: reuse nếu còn hạn + model không đổi; ngược lại tạo mới
    (OpenOrCreateSessionManager mở/tạo var/sky-sessions/<id>.jsonl)
  → prompt → trim 2000 ký tự → append assistant message → trả về transcript
```

### 3.3 Ask Sky / generative UI (one-shot)

```
askSky(request)                                      [runtime/orchestrator.server.ts]
  → routeRequest(request): match regex /compose|generate|render|panel|surface|openui/i?
      có  → chạy profile sky-generative-ui → validateProgram(maxChars, allowList)
             → { status: "handled", program } | { status: "rejected", reason }
      không → chạy profile sky-orchestrator → { status: "answered", text }
```

Không có vòng lặp agent-gọi-agent. `maxSteps` trong profile là **metadata, không được code enforce** —
mọi turn đều single-shot (`tools: []`, không function calling).

## 4. Pi SDK boundary (`runtime/pi.server.ts`)

Những gì `createSession()` làm, theo thứ tự:

1. **Key**: đọc `SKY_OPENROUTER_API_KEY` (chỉ env; trim; rỗng ⇒ throw `missing_key`).
2. **Model**: `currentAgentModel()` (xem §5); `SKY_OPENROUTER_BASE_URL` trỏ `/v1` tương thích OpenAI
   (dùng cho smoke test với mock server).
3. **Lazy import**: `await import("@earendil-works/pi-coding-agent")` — cache promise, SDK không
   bao giờ nằm trên critical path lúc module load hay trong client bundle.
4. **models.json tạm** (`tmpdir()/nsac-pi-models-<pid>/models-<hash>.json`, sha256 16 ký tự):
   - *Probe*: `ModelRuntime.create({ modelsPath: probe, authPath })` — kiểm tra model đã có trong
     catalog OpenRouter không (`getModel("openrouter", model)`).
   - *Known model*: `modelOverrides: { <id>: { maxTokens: 2048 } }` — giữ nguyên entry catalog.
   - *Unknown model*: ghi full `models` entry kèm `maxTokens: 2048`.
   - `authPath` chỉ đặt trong tmpdir (0600), **không** chạm keychain/config thật của user.
5. **SettingsManager.inMemory**: `retry: { enabled: false }` (không tự retry khi provider lỗi —
   caller quyết định fallback), `cacheWarming: "off"`.
6. **SessionManager**: caller truyền vào (chat/hud-composer mở file `var/sky-sessions/<id>.jsonl`),
   mặc định `SessionManager.inMemory()`.
7. **DefaultResourceLoader** với **tất cả resource bị tắt**:
   `noExtensions, noSkills, noPromptTemplates, noThemes, noContextFiles: true`,
   `systemPromptOverride` trả về đúng `profile.systemPrompt(ctx)` (kèm `promptSuffix` nếu có),
   `appendSystemPromptOverride: () => []`.
8. **`createAgentSession({ ..., tools: [], customTools: [] })`** — agent không có bất kỳ tool nào.
9. **Turn loop**: `session.subscribe` bắt `message_update` (`text_delta` → stream cho client;
   `error` → ghi nhận) và `message_end` (stopReason `error`/`aborted` → ghi nhận). Sau `prompt()`
   resolve: có lỗi turn ⇒ throw; tổng text rỗng ⇒ thử phục hồi từ assistant message cuối cùng,
   vẫn rỗng ⇒ throw `empty_reply`. **SDK resolve `prompt()` bình thường kể cả khi turn hỏng**
   (ví dụ provider 402) — không được coi là thành công.
10. `dispose()` idempotent; mọi caller đều `dispose()` trong `finally`-style path.

Constant: `SKY_MAX_TOKENS = 2048` (Sky trả lời vài câu ngắn; không kế thừa catalog default).

## 5. Model resolution (`runtime/agent-model.server.ts`)

Thứ tự ưu tiên — **toàn cục, không theo từng profile**:

1. Backend SQLite `app_settings.agent.model` (`GET /api/settings/agent-model`, timeout 1200 ms;
   `PUT` từ `/admin` với `SKY_ADMIN_KEY` — xem `apps/web/AGENTS.md`)
2. `lastGood` — giá trị backend trả về lần gần nhất (backend lỗi tạm thời)
3. `SKY_OPENROUTER_MODEL`
4. Hardcoded `DEFAULT_MODEL = "thinkingmachines/inkling-2-small:free"`

Cache: TTL 2 s (burst: composer + orchestrator + chat cùng turn); fail → TTL 0.5 s, không kéo dài.
`modelChanged()` dùng để huỷ session chat khi admin đổi model. `/health` hiển thị effective model
bằng đúng hàm này.

## 6. Profiles & registry

| Id | Role | Output contract | maxChars | Timeout | Session |
|---|---|---|---|---|---|
| `sky-orchestrator` | orchestrator (SOUL Sky) | `text` | — | 45 s | one-shot, in-memory |
| `sky-chat` | companion (Sky, voice) | `text` | — | 45 s | per-astronaut, `var/sky-sessions/<id>.jsonl` |
| `sky-generative-ui` | openui spec generator | `openui-program` | 4000 | 30 s | one-shot |
| `sky-hud-composer` | hud composer | `openui-program` | 4000 | 30 s | per-astronaut, `var/sky-sessions/<id>.hud.jsonl` |

Mọi profile: `soul = skySoul`, `tools = []`, `handoff` = regex tĩnh (orchestrator) hoặc rỗng,
model env `SKY_OPENROUTER_MODEL`. Constraints voice Sky (chat profile): tối đa 3 câu, một câu hỏi,
không chẩn đoán, không bịa số/ngưỡng, không claim dữ liệu sensor live, nhắc "chưa actioned đến khi
bạn xác nhận", không dùng chữ "AI".

**Thêm agent mới**: tạo `agents/<tên>.ts` (theo đúng shape trên) → thêm vào `AGENT_REGISTRY` +
`AgentId` union → test row trong `agents/registry.test.ts` (registry assert đủ 4 field ổn định) →
runtime tự pick-up qua `getAgent(id)`. Không cần chạm `pi.server.ts`.

## 7. Cách các agent phối hợp

| Cơ chế | Hiện trạng |
|---|---|
| LLM routing giữa agent | **Không có.** `routeRequest()` là regex trên request string |
| Orchestrator → specialist | Một chiều: orchestrator không nằm trên đường generative-ui/hud-composer; chat không dispatch |
| Agent-gọi-agent / vòng lặp | Không. `maxSteps` là metadata, không enforce; không ai gọi lại ai |
| Shared context giữa agents | Không. Mỗi session chỉ thấy system prompt của profile + message của chính nó |
| Persistent memory | Chat & hud-composer: `SessionManager` JSONL + transcript `<id>.json` (UI-facing). One-shot agents: không nhớ gì |
| Điều phối deterministic | Code: regex (`routeRequest`), queue per id, cache per (id, locale), eviction |
| Hành động có side effect | **Không agent nào có.** Mọi action y tế đi qua Confirm của phi hành gia (luật HKT số 4) |

State nằm ở **files trong `var/sky-sessions/`** (gitignored, mode 0600), không trong DB; model đổi
⇒ session bị dispose và tạo lại (lịch sử vẫn nằm trong JSONL). Trên box production, thư mục làm
việc là `~/nsac` (systemd `nsac-web.service`).

## 8. Tools và Skills — **hiện không dùng, cố ý**

Trong code hiện tại, agent Pi SDK chạy với **zero tools**:

- `createAgentSession({ tools: [], customTools: [] })`
- `DefaultResourceLoader({ noExtensions: true, noSkills: true, noPromptTemplates: true, noThemes: true, noContextFiles: true })`

Lý do:

1. **Luật HKT số 4** — AI không quyết định một mình; phát hiện là deterministic (median/MAD, slope,
   ruptures trong backend TS), LLM chỉ giải thích/trích checklist/soạn draft; hành động chờ Confirm.
2. **Không side effect** — agent không được đọc/ghi file, chạy bash, gọi network tuỳ ý; toàn bộ
   giao tiếp với thế giới là một lượt text/program đầu ra, bị code validate sau đó.
3. **Prompt injection** — nội dung issue/transcript/fixture là data, không phải lệnh; tắt mọi
   resource discovery giữ bề mặt tấn công bằng 0.
4. **Deterministic + testable** — test inject `SessionFactory` giả, không cần network/model thật.

Pi SDK **có** hỗ trợ đầy đủ (docs `sdk.md`, `skills.md`, `tools`/`extensions`) và chưa bật ở đây:

| Khả năng SDK | Cách bật | Ghi chú |
|---|---|---|
| Built-in tools (read/bash/edit…) | `createAgentSession({ tools: [...] })` / `noTools` | Chưa cần; nếu bật, mọi output vẫn qua gate |
| Custom tools | `customTools: [tool…]` | Phải nằm sau Confirm; không cho tự hành động |
| Skills (SKILL.md, agentskills.io spec) | `DefaultResourceLoader` với skills path, `noSkills: false`; `/skill:name` ép load | Skill chỉ là instructions — không thay đổi quyền |
| Prompt templates | `noPromptTemplates: false` + templates dir | Như skill nhưng không đóng gói assets |
| Extensions (codemode, tool_search, MCP) | `extensionFactories` trong loader; SDK **không** tự load MCP như CLI | MCP ⇒ tool từ ngoài; cần review allowlist |
| Context files (AGENTS.md…) | `noContextFiles: false` | Đã tắt để system prompt đúng bằng profile |
| Session persistence | `SessionManager.open/create(path)` | Đang dùng cho chat + hud-composer |

Điều kiện để bật bất kỳ cái nào ở trên: (a) hành động vẫn chặn sau Confirm; (b) ngưỡng/trọng số có
`source_url`; (c) test không chạm network; (d) không log key/transcript ra client.

## 9. Output contracts & validation

- **`text`** (orchestrator, chat): trả thẳng; chat trim 2000 ký tự, không rỗng.
- **`openui-program`** (generative-ui, hud-composer): `validateProgram()` / `reviewProgram()` —
  1. strip code fences; rỗng ⇒ `empty`
  2. quá `maxChars` (4000) ⇒ `too_long`
  3. **chữ số trong program ⇒ `digit_in_text`** — số chỉ vào UI qua `Fact`/`MetricTile` id
     (`heartRate`, `respiration`, `spo2`, `sleep`, `missionDay`), resolve lúc render
  4. mọi `PascalCase` token phải thuộc allow-list (REACT_BITS_NAMES / HUD_COMPONENT_NAMES /
     surface allow-list) ⇒ `unknown_component`
  5. ít nhất một component hợp lệ ⇒ `no_component`
- Vi phạm ⇒ `rejected`, không cache; HUD giữ preset (`HUD_PRESET_EN/VI`) làm đường render chính.
- `SURFACES` (`agents/surfaces.ts`): allow-list theo surface — hiện chỉ `orbit-panel`; thêm surface
  là một dòng. Chat/HUD **không** render được nếu output không qua cổng này.

## 10. Failure modes

| Status | Nghĩa | Xử lý phía caller |
|---|---|---|
| `ok` | Turn xong, text non-empty | Dùng kết quả |
| `missing_key` | Không có `SKY_OPENROUTER_API_KEY` | UI báo cấu hình; không retry |
| `unavailable` | SDK lỗi / provider lỗi / `empty_reply` / input không hợp lệ | Session bị huỷ; HUD giữ preset |
| `timeout` | Quá `profile.timeoutMs` (AbortController + Promise.race) | Session bị huỷ; báo timeout |
| `rejected` | OpenUI program không qua gate | Không cache; preset giữ nguyên |
| `answered` / `handled` | askSky phân loại xong | Render text / render program |

`missing_key` vs `unavailable` vs `timeout` được phân biệt ở mọi layer (runner → function → UI).
Không có retry tự động; lỗi log `console.warn("agent turn failed", …200 ký tự)` server-side.

## 11. Testing

- Không network, không model thật. Inject `SessionFactory` giả qua:
  `setSessionFactory` (run.server), `setChatSessionFactory` (astro-chat.server),
  `setHudSessionFactory` (hud-compose.server); `resetAgentModelCacheForTests()` cho model cache;
  `resetChatStateForTests()` / `resetHudComposeStateForTests()` xoá cache.
- `agents/registry.test.ts` assert mọi profile đủ field + defaultModel non-empty.
- `astro-chat.session.test.ts` cover persistent SessionManager path (tmp dir).

## 12. Environment & files

| Biến / file | Ý nghĩa |
|---|---|
| `SKY_OPENROUTER_API_KEY` | Key OpenRouter (env-only trong `features/agent`; đặt qua `/etc/nsac-web/env` trên box) |
| `SKY_OPENROUTER_MODEL` | Model mặc định khi backend chưa cài `agent.model` |
| `SKY_OPENROUTER_BASE_URL` | Override `/v1` base (smoke test với mock OpenAI-compatible) |
| `BACKEND_URL` | Base backend cho `agent-model.server` (default `http://127.0.0.1:3200`) |
| `NSAC_SKY_SESSIONS_DIR` | Override thư mục session (default `var/sky-sessions`) |
| `SKY_ADMIN_KEY` | Bật `/admin`; model đổi qua backend `PUT /api/settings/agent-model` |
| `var/sky-sessions/<id>.jsonl` | SessionManager history của chat |
| `var/sky-sessions/<id>.hud.jsonl` | SessionManager history của hud-composer |
| `var/sky-sessions/<id>.json` | Transcript UI (trim 40 message, 0600) |
| `tmpdir()/nsac-pi-models-<pid>/` | models.json + auth.json tạm (0600/0700) |

## 13. Giới hạn & điểm cần biết

- `AgentProfile.modelEnv` và `defaultModel` là **metadata**; model thực tế resolve toàn cục qua
  `currentAgentModel()` — profile không override được. `hud-composer.ts` đang ghi
  `anthropic/claude-sonnet-4.5` trong `defaultModel` nhưng **không có hiệu lực** (lỗi thời, cần dọn).
- `maxSteps` / `tools` / `handoff` trong profile không được enforce — hành vi thực tế là single-shot,
  không tool. Khi muốn agent nhiều bước thật, phải thêm vòng lặp + trần bước + gate.
- `routeRequest()` chỉ match regex tiếng Anh compose-flow; mọi thứ khác rơi vào orchestrator.
- Chat/composer sống per-astronaut trong cache `MAX_CACHED = 6`, TTL 20 phút; HUD program cache
  15 phút, tối đa 24 entry.
- JSONL không compaction — session file lớn dần theo lịch sử (Pi SDK compaction chưa bật).
- `/health` không lộ key; chỉ `keyConfigured: boolean` + effective model.
- Vision per-astronaut pairs + hazard workers + broadcast bus: `docs/AGENT_BROADCAST.md` (chưa build).

## 14. Liên quan

- `ARCHITECTURE.md` §5 — web app, vị trí `features/agent` trong tổng thể
- `apps/web/AGENTS.md` — contract web app (hud-gen, `/admin`, `/health`)
- `AGENTS.md` (root) — HKT rules, hard rules số 3–5 về nguồn và Confirm
- Pi SDK docs vendored: `apps/web/node_modules/@earendil-works/pi-coding-agent/docs/` (`sdk.md`, `skills.md`, `sessions.md`, `session-format.md`)
