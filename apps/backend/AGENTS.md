# apps/backend — Sky backend API

## Purpose

HTTP API của Sky cho box demo single-node: Bun chạy thẳng TypeScript, Drizzle trên `bun:sqlite`, không auth (demo). Cung cấp crew/claims, broadcast events, sensors + telemetry WS, settings (gồm ElevenLabs key cho Sky TTS), `/api/tts`, health observation layer (năng lượng/cơ/giấc ngủ/nước) cho `apps/web`, và Speech Engine websocket cho voice chat `/`.

## Ownership

- Package này sở hữu `/health`, `/api/astronauts`, `/api/claims`, `/api/agent-traces`, `/api/events` + `/api/cursors`, `/api/sensors/*` + `/ws/telemetry`, `/api/settings/agent-model` + `/api/settings/agent-models`, `/api/settings/elevenlabs-key`, `/api/settings/speech-engine*`, `/api/tts`, `/api/health/*`, `/api/speech/register`, `/api/speech/config`, Speech Engine websocket (`SPEECH_WS_PORT`, mặc định 3300, path `/speech/ws`) và `/api/clinical/*` (findings + routines — xem mục "Clinical routine engine").
- Không sở hữu UI: `apps/web` là consumer. Không import lẫn với backend Python `backend/src/nsac/` (layer khác, contract riêng).
- `tests/` phản chiếu module trong `src/`; ngoại lệ: `src/speechAdmin.test.ts` nằm cạnh module của nó (thêm cùng đợt admin surface). Fixture DB đi qua `SKY_DB_PATH` tmp (`tests/settings-agent-models.test.ts` cover route mới).

## Local Contracts

### DB ownership

- `src/db/client.ts` là connection chính (`db`): `astronauts`, `astronaut_claims`, `app_settings`, `health_observations`. `ensureSchema()` tạo bảng + index idempotent; repo không có lịch sử migration nên không chạy `drizzle-kit generate`/`push`, DDL ở `ensureSchema` là nguồn sự thật.
- Connection riêng (cùng `SKY_DB_PATH`): `claimsClient`, `eventsClient`, `sensorsClient`, `settingsClient`, `traceClient`. Lý do: `bun test` chia sẻ module cache trong một process, file test cần DB riêng phải bind qua connection riêng trước khi module load.
- Thêm bảng: schema `src/db/schema/<name>.ts` + export ở `schema/index.ts` + DDL/index trong `ensureSchema` + repo ở `src/db/repositories/`. Không sửa/xoá block `ensureSchema` của bảng cũ.
- `agent_traces` (debug telemetry mỗi agent turn, ghi bởi web qua HTTP loopback — xem HARNESSING §16): schema `schema/agentTraces.ts`, DDL + 2 index trong `ensureSchema` của `traceClient` (`(astronaut_id, id)` và `(agent_id, created_at)`), repo `repositories/agentTraces.ts`. Retention: giữ tối đa 5000 rows mới nhất VÀ xoá rows cũ hơn 7 ngày — prune chạy trong `insertTrace` mỗi 50 insert (theo id), best-effort, không bao giờ làm hỏng turn. Redaction trước khi insert: `sk_…` / `sk-…` / `oc_sk_…` / `Bearer …` → `[redacted]` (repo `redactText`, áp cho `user_text`/`reply_text`/`tools_json`); không bao giờ ghi API keys, headers hay secrets. `tools_json` chỉ `{name, ok?, ms?}` — tool arguments không bao giờ được lưu.
- `health_observations` dùng chung `db` như `readingsRepo` — không mở connection thứ ba (một writer, WAL).

### Routes

- `/api/settings/agent-model` (legacy): `GET` → `{ model, updatedAt }`; `PUT { model }` (MODEL_ID_REGEX, trim) → upsert. Giữ nguyên hành vi cho back-compat; box deploy sau đổi web nên chạy được cả hai.
- `/api/settings/speech-engine*` (admin surface, loopback-only như mọi route admin, web gate bằng `SKY_ADMIN_KEY`):
  - `GET /api/settings/speech-engine` → chỉ local state, không gọi ElevenLabs: `{ ok: true, configured, engineId, source: "env"|"db"|null, wsRunning, port, lastError, apiKeyConfigured, envOverridesDb }`. `configured` = effective id tồn tại VÀ WS đang chạy. `envOverridesDb` = true khi env id set VÀ DB row cũng set (UI cảnh báo DB bị lấn át).
  - `POST /api/settings/speech-engine/probe` body `{}` → `GET {ELEVENLABS_API_BASE}/v1/speech-engine?page_size=1` (header `xi-api-key`); `{ ok: true, httpStatus }` khi key được chấp nhận, ngược lại `{ ok: false, httpStatus, message }` (message đã cắt ≤300 chars, không bao giờ chứa key; body non-JSON → message generic).
  - `POST /api/settings/speech-engine/create` body `{ name?, wsUrl? }` (defaults `sky-nsac-speech-engine` / `wss://nasa.taquangkhoi.com/speech/ws`; `wsUrl` validate bằng `new URL` + bắt buộc `protocol === "wss:"` → 400 `bad_ws_url`) → `POST /v1/speech-engine` `{ name, speechEngine: { wsUrl } }`; đọc id từ response (`speech_engine_id` / `speechEngineId` / `id`), lưu qua `settingsRepo.setSpeechEngineId()`, `restartSpeechEngine()`; id không đọc được → `{ ok: false, message: "created but engine id unreadable…" }` và KHÔNG lưu gì. Env id set → response thêm `envShadowing: true`. HTTP error upstream → forward `{ ok: false, httpStatus, message }`.
  - `POST /api/settings/speech-engine/stop` → `stopSpeechEngine()` → `{ ok: true, wsRunning: false }`. `POST /api/settings/speech-engine/start` → `restartSpeechEngine()` → `{ ok: true, wsRunning }`.
  - `POST /api/settings/speech-engine/delete` body `{ id? }` (mặc định effective id; thiếu cả hai → 400 `no_engine`) → `DELETE /v1/speech-engine/{id}`; thành công + DB id == id bị xóa → `clearSpeechEngineId()`. Source `env` → thêm `note` ("env ELEVENLABS_SPEECH_ENGINE_ID still set…"). KHÔNG restart WS (WS không phụ thuộc id).
  - Body cap 4 KB, zod-validated, cùng envelope lỗi `{ ok: false, error }`. Upstream calls qua `fetchImpl` injectable (mặc định global fetch) — `ELEVENLABS_API_BASE` const (env override) + `handleSpeechAdminRequest(req, fetchImpl?)` là test seam. Implement ở `src/speechAdmin.ts` (export `handleSpeechAdminRequest`, wiring trong `server.ts` trước `handleSpeechRequest`).
- `/api/settings/agent-models`: `GET` → `{ provider, model, models, updatedAt }`
  (`provider`/`models` null khi chưa set, `model` = legacy raw, `updatedAt` = max của 2 key mới hoặc null).
  `PUT { provider?, model?, models? }` — mỗi field optional, `null` = xoá key tương ứng; `models` là thay thế
  **toàn bộ** map `{profileId: modelId}` (`{}`/null xoá key): keys `^[a-z0-9-]{1,64}$`, ≤16 entries, values MODEL_ID_REGEX;
  provider enum strict `opencode-go|openrouter|amazon-bedrock`. Mọi field ghi trong **một** transaction.
  DB keys: `agent.provider`, `agent.models` (JSON string) trong `app_settings`.
- `/api/agent-traces` (debug telemetry, mở như `/api/events`, bind 127.0.0.1): `POST { astronautId, agentId, sessionId?, provider?, model?, ok, errorCode?, latencyMs, userText, replyText?, tools? }` (strict, body cap 12 KB → 413; `userText`/`replyText` ≤ 4000 chars; `tools` ≤ 20 entries `{name ≤ 64, ok?, ms?}` — arguments không nhận) → 201 `{ id }`; repo redact + prune trước khi insert. `GET ?astronautId=&agentId=&ok=&since=&limit=` — newest first (`id DESC`), `limit` mặc định 50, clamp ≤ 200, `since` = unix ms, `ok` chỉ nhận `true|false|1|0` → `{ rows, limit }` (camelCase, tools đã parse). `GET /api/agent-traces/:id` → row hoặc 404 `not_found`. Không phải chat history — chỉ debug telemetry (HARNESSING §16).
- Handler dạng `handleXRequest(req): Promise<Response | null>`; trả `null` khi path/method không thuộc module để `server.ts` fall-through về 404. Thứ tự wire trong `server.ts`: claims → agent-traces → settings → speech → tts → events → sensors → health → astronauts.
- Lỗi luôn JSON `{ ok: false, error }` với 400/404/409/413. Đọc body có cap `Content-Length` + kiểm tra lại sau khi đọc (xem `eventsRoutes.ts`).
- `GET /api/health/performance/:astronautId` → `{ astronautId, asOf, metrics[], derived }`: mỗi metric có `latest`, `delta30d` (latest − điểm cũ nhất trong 30 điểm), `points` 30 giá trị tăng dần, `baseline`, `method`, `quality`, `source`. 404 `unknown_astronaut`; 400 `bad_astronaut`; astronaut chưa có data → 200 `metrics: []`, `derived: {}`.
- `GET /api/health/observations?astronautId=&metric=&limit=` → mảng row thô mới nhất trước (`ts DESC`), `limit` 1..500 (mặc định 500), query sai → 400 `bad_query`. `energy_balance` không nhận làm `metric` (derived).
- Query/param validate bằng zod ở `src/healthSchemas.ts` (query) và `src/sensors/routes.ts` (body).

### ElevenLabs key + Sky TTS

- `app_settings` key `elevenlabs.api_key` (hằng `ELEVENLABS_KEY` trong `src/db/repositories/settings.ts`). Write-only theo hợp đồng: `GET /api/settings/elevenlabs-key` chỉ trả `{ configured, updatedAt }` (qua `settingsRepo.getElevenLabsStatus()`, không đọc value); PUT validate `^[A-Za-z0-9_\-]{10,512}$` sau trim (→ 400 `bad_key`), upsert, không echo key; DELETE xoá row → `{ ok: true, cleared: boolean }`. Chỉ `handleTtsRequest`, Speech Engine (`startSpeechEngine`) và speech admin surface (`speechAdmin.ts` `getApiKey()`) được gọi `settingsRepo.getElevenLabsKey()` — không caller nào khác được nhận giá trị key.
- `POST /api/tts` `{ text 1..1000 }` (body cap 8192 bytes): chưa có key → 503 `tts_not_configured`; gọi `https://api.elevenlabs.io/v1/text-to-speech/{voiceId}` (header `xi-api-key`, body `{ text, model_id: "eleven_flash_v2_5" }`, `eleven_flash_v2_5` hỗ trợ Vietnamese); voice mặc định Rachel `21m00Tcm4TlvDq8ikWAM` — override bằng env `ELEVENLABS_VOICE_ID`; AbortController 25 s → 504 `tts_timeout`; upstream non-2xx / mất mạng → 502 `tts_upstream` (server chỉ log status code, không log key, không log body upstream); thành công → bytes `audio/mpeg` + `cache-control: no-store`. Key không bao giờ được log/echo ở bất kỳ path nào.

### Speech Engine (ElevenLabs voice chat, 2026-11-15)

- Cùng process với HTTP server (`startSpeechEngine()` trong `server.ts` sau seed), port loopback riêng: `SPEECH_WS_PORT` (mặc định 3300, `127.0.0.1`, mọi path đều nhận — port này single-purpose, JWT-gated). Không có service thứ hai.
- Wire protocol (hand-rolled trên `Bun.serve({ websocket })` — xem `src/speechEngine.ts`): in `init { conversation_id }`, `user_transcript { user_transcript[], event_id? }`, `ping`, `close`, `error`; out `agent_response { content, event_id?, is_final }`, `pong`. Lý do hand-roll (verified 2026-11-15): `@elevenlabs/elevenlabs-js` `SpeechEngine.Server` dùng `node:http` + `ws` — dưới Bun, server nhận TCP connection nhưng **không bao giờ trả lời** (curl/fetch treo; SDK `start()` không listen được đúng cách). JWT verify được replicate chính xác từ SDK source (HS256, secret = SHA-256 của API key đã strip `_residency_<region>`; `iss=https://api.elevenlabs.io/convai/speech-engine`, `sub=convai_speech_engine_upstream`, leeway 60 s) và **luôn bật** — không có `disableAuth`. Đã cross-check 9 case với SDK `verifySpeechEngineJwt` (match hoàn toàn); backend KHÔNG giữ dependency `@elevenlabs/elevenlabs-js`.
- Env: `ELEVENLABS_SPEECH_ENGINE_ID` (bắt buộc cho websocket; thiếu cả env lẫn DB → websocket không start, `console.error` 1 dòng, HTTP routes vẫn chạy) · `ELEVENLABS_API_KEY` (env ưu tiên; thiếu → fallback `/admin` key qua `settingsRepo.getElevenLabsKey()`; source chỉ log tên, không bao giờ value) · `SPEECH_WS_PORT` · `SKY_WEB_CHAT_URL` (base URL của web cho SSE upstream, mặc định `http://127.0.0.1:3100`).
- Engine id resolution: **env `ELEVENLABS_SPEECH_ENGINE_ID` thắng, DB `app_settings` key `speech_engine.id` là fallback** (`resolveEngineId()` trong `speechEngine.ts`; `/api/speech/config` + websocket dùng chung resolver). DB row do `/admin` Speech Engine tab set (`settingsRepo.getSpeechEngineId()` / `setSpeechEngineId()` / `clearSpeechEngineId()`, mirror các helper elevenlabs key). Resolution chỉ đổi hiệu lực sau restart/refresh WS — env shadowing DB được báo qua `envOverridesDb` ở `GET /api/settings/speech-engine`.
- Lifecycle: `startSpeechEngine()` giữ handle module-level `speechServer = { server, port }`; `stopSpeechEngine()` gọi `server.stop(true)` (đóng cả socket đang mở), `restartSpeechEngine()` = stop + start; `speechEngineStatus()` trả `{ wsRunning, port, lastError, engineId, engineSource }` (chỉ local state). Boot log: `[speech] engine id source: env|db (<id>)` — id là public handle, log được. `lastError` giữ lỗi start gần nhất (thiếu id, thiếu key, bind port) và được clear khi start thành công.
- Binding: browser `POST /api/speech/register { astronautId }` (zod 1..64, roster-check `astronautsRepo.get`, không biết → 404 `unknown_astronaut`) → in-memory `Map`, TTL 10 phút, **consumed** ở `init` (most recent unexpired). Không có registration → fallback `ayla-reyes` + warn log. `conversationId → astronautId` giữ trong memory (xóa khi `close`/`disconnected`).
- `onTranscript`: lấy `findLast(m => m.role === "user")?.content`; POST `${SKY_WEB_CHAT_URL}/api/chat-stream` `{ astronautId, message, mode: "voice" }`; SSE parse incremental — `delta` cộng dồn, `ui` drop có log (phase 1), `error` → không `sendResponse`, stream cắt khi có frame `done` → `sendResponse(full.trim())` đúng một lần; abort (user ngắt) → hủy đọc body, không `sendResponse`. Turn mới abort turn cũ.
- `GET /api/speech/config` → `{ engineId }` (env; unset → 404 `{ ok: false, error: "no_engine" }`). Engine id là public instance handle, không phải secret. API key không bao giờ rời process backend.
- **ĐÃ deploy 2026-11-16** (`deploy-2026-11-16`, box = `4785c81`): Caddy route `/speech/ws` → `127.0.0.1:3300` đã live (repo `opfa-aws-manage`, file `caddy/sites/nasa.taquangkhoi.com.caddy`). WS chỉ listen khi có env `ELEVENLABS_SPEECH_ENGINE_ID` + key JWT verify (env `ELEVENLABS_API_KEY`, hoặc fallback key `/admin` trong DB — key `/admin` không có `convai_*` nên chỉ đọc local HMAC, đủ để verify). Tạo engine: `bun scripts/speech-engine.ts ensure` (cần key có `convai_read`/`convai_write` — key TTS-only từ chối 401). Sau khi có engine id: append `ELEVENLABS_SPEECH_ENGINE_ID=<id>` vào `/etc/nsac-web/env`, `systemctl restart nsac-backend`, kiểm tra port 3300 listen + `curl /api/speech/config` trả `{engineId}`.
- Body sizes nhỏ cố ý (transcript ≤ vài KB); websocket `maxPayloadLength` 64 KB; không log JWT, không log key, không log token contents.

### Clinical routine engine

- `src/clinical/` — Clinical Routine Engine deterministic, **không LLM, không PI SDK** (HARNESSING §17). P0 + `sky-cardio` end-to-end (branch clinical-p0-backend, 2026-11-16).
- Bảng (connection riêng `src/db/clinicalClient.ts`, cùng `SKY_DB_PATH`, DDL trong `ensureSchema` là nguồn sự thật): `clinical_findings` (id TEXT PK; severity CHECK green|yellow|red|unknown; status CHECK new|reviewed|resolved DEFAULT 'new'; evidence JSON; `requires_medical_review` INTEGER; index `(astronaut_id,status,created_at)` + `(specialist_id,created_at)`), `routine_runs` (id PK; status CHECK running|ok|skipped_quality|cooldown|failed; UNIQUE `(routine_id, astronaut_id, bucket)`), `clinical_audit` (id PK; finding_id/action/detail/created_at), `clinical_state` (key PK — `sky-cardio.last_observed_at:<id>`, informative only).
- Routes (`handleClinicalRequest(req)`, wire sau sensors, trước health; order: claims → agent-traces → settings → speech → tts → events → sensors → clinical → health → astronauts):
  - `GET /api/clinical/findings?astronautId=&status=new|reviewed|resolved|all&limit=1..100` → `{ ok: true, findings: [...] }` (newest first, evidence parsed, camelCase; default status=new).
  - `GET /api/clinical/findings/:id` → `{ ok: true, finding }` | 404 `not_found`.
  - `POST /api/clinical/findings/:id/review` `{ action: "reviewed"|"resolved", note?: string ≤300 }` (strict, cap 4 KB) → status + `updated_at`, audit row; `resolved` → publish `medical.finding.resolved`; 400 `bad_action`/`bad_body`; 404 `not_found`. Chỉ review/ack — không có medical action endpoint.
  - `GET /api/clinical/routines` → `{ ok: true, routines: [{ ...definition, routineId, lastRuns: [{ astronautId, bucket, status, finishedAt }] }] }` — không secrets/guidance.
  - `POST /api/clinical/routines/:id/run` `{ astronautId?: string ≤64 }` (strict, cap 4 KB; omit → cả 6 crew) → forced manual run (bucket `manual-yyyymmddThhmm`, **cooldown vẫn áp dụng**, `{ ok: true, results: [{ astronautId, status, findingId? }] }`); routine id lạ → 404 `not_found`; body sai → 400 `bad_body`.
  - Lỗi luôn JSON `{ ok: false, error }`; Content-Length cap pattern như các route khác.
- Scheduler (`src/clinical/scheduler.ts`): `setInterval` `CLINICAL_TICK_SECONDS` (default **30**, unref, tắt khi `CLINICAL_DISABLED=1`); start từ `server.ts` sau seed (cạnh `startSpeechEngine()`). Bucket idempotent qua UNIQUE: interval = UTC `yyyymmddThhmm` (due = bucket HOÀN THÀNH gần nhất), daily = server-local `yyyymmdd` (due khi local ≥ 07:00), manual = `manual-…` (chỉ qua route). Claim = INSERT `running`; conflict → skip; row cũ `failed` + attempts<3 → attempts+1 retry (≤3). `event` routine RESERVED — không implement V1 (telemetry chưa có bus topic). Retry ≤3; timer không bao giờ throw; publish fail không rollback finding.
- Cooldown (`src/clinical/findings.ts`, `CLINICAL_COOLDOWN_MINUTES`, default **30**): suppress finding cùng severity trong 30 phút; severity **escalation** không bao giờ bị suppress; suppressed → routine_runs `cooldown`, không tạo audit row.
- Cardio-v1 policy (`src/clinical/cardio.ts`, `baseline.ts`) — **ENGINEERING DEMO POLICY, NOT CLINICAL GUIDANCE**: yellow = |z|≥2.5 sustained ≥5 hoặc single |z|≥3.5; red = |z|≥3.0 sustained ≥5 hoặc single |z|≥4.5; MAD==0 → fallback EWMA-residual; degenerate → `unknown` (không green). Severity chỉ từ rule engine. Method: Leys et al. 2013 DOI 10.1016/j.jesp.2013.03.013 (DOI prompt ghi nhầm sang bài proteomics); HRP Evidence Reports + Circulation 2026 là context không phải threshold; NASA-STD-3001 Vol 1 Rev C (2023-09-15) — không copy ngưỡng Rev B; clinical thresholds out of scope. Quality gate: <12 valid / >30% degraded/missing / newest valid >10 phút → `skipped_quality` (range 30–220 bpm = technical sensor-range, NOT clinical). dataKind luôn `simulated` ở V1.
- Events mới trong `eventsRoutes.ts`: `medical.finding.created` (`{findingId, specialistId, severity(4), requiresMedicalReview}`), `medical.finding.resolved` (`{findingId, action:'resolved'}`), `medical.review.requested` (`{reason ≤300}`, reserved cho web Medical Officer tương lai). Clinical publish qua `clinical/publish.ts` — direct insert `change_events` + `eventsBus.emit`; KHÔNG HTTP-loopback.
- `clinicalDb` chỉ dùng bởi `src/clinical/*`; không đụng `db/client.ts` (health_observations) hay eventsClient/sensorsClient cho clinical tables.
- Tests: `tests/clinical-{quality,baseline,cardio,scheduler,events,routes}.test.ts` (tmp `SKY_DB_PATH` pattern). Known pre-existing failure: `tests/readings.test.ts` (không liên quan, không được "fix").
- Verification: `bun test` (216 pass, 1 fail pre-existing). Smoke: `SKY_DB_PATH=<tmp> PORT=3311 bun run src/server.ts` → `curl /api/clinical/routines`; E2E: seed HR telemetry (script scratch với `telemetryRepo`, hoặc sim `anomaly_symptom` qua `/api/sensors/sim/start`) → `POST /api/clinical/routines/sky-cardio:manual/run` → finding yellow/red.

### Health observation layer


- 11 metric được lưu: `calories_burned`, `calories_intake`, `muscle_mass`, `muscle_strength`, `body_fat`, `sleep_duration`, `sleep_efficiency`, `hrv_ms`, `water_intake`, `exercise_minutes`, `heart_rate_bpm`. `energy_balance` là derived (`calories_intake − calories_burned`), không lưu row.
- Seed idempotent theo cặp `(astronaut, metric)`: chỉ ghi khi cặp rỗng; gọi từ `server.ts` sau `astronautsRepo.seed()` (FK). Deterministic: `mulberry32(seedFromString("<astronautId>|<metric>"))` từ `src/sensors/prng.ts`; 35 ngày × 1 row/ngày, `ts` là 00:00Z.
- Mỗi row: `source: "synthetic"`, `method` ∈ `sensor | measured | estimated | self_reported | simulated`, `quality` ∈ `valid | suspect | invalid`, `confidence` 0..1. Seed hiện tại emit daily cho mọi metric; cadence thật (DXA định kỳ, grip theo phiên) là out of scope.
- Formula + toàn bộ số tuning + URL nguồn ở `src/health/metrics.ts` (`HEALTH_METRIC_SPECS`, `HEALTH_TUNING`, `baselineFor`). Drift trên cửa sổ 35 ngày: muscle mass −0.5%, muscle strength −1.5%, body fat +0.3 điểm %, HRV −6 ms.

### No thresholds / no clinical claims

- Layer này không alert, không chẩn đoán, không ngưỡng lâm sàng. Baseline là **simulator tuning**, không phải clinical guidance; UI phải hiển thị đúng `method`/`quality`/`source`.
- Mọi con số ngoài đời trong comment/UI phải kèm URL nguồn. AI chỉ giải thích/soạn draft; hành động cần phi hành gia xác nhận.
- Không dữ liệu cá nhân: chỉ crew hư cấu `ayla-reyes`, `dae-jung-park`, `lena-fischer`, `tomas-ortega`, `yuki-tanaka`, `noor-abbasi` (nguồn: `src/db/repositories/astronauts.ts`).

### Sources (đối chiếu, không phải ngưỡng)

- Cơ/xương, khối cơ, body fat, sức mạnh, liều tập: https://humanresearchroadmap.nasa.gov/evidence-reports/human-health-risks-of-space-exploration-for-mission-design/musculoskeletal/
- Giấc ngủ (actigraphy): https://humanresearchroadmap.nasa.gov/evidence-reports/human-health-risks-of-space-exploration-for-mission-design/sleep/
- Tim mạch / LV-stroke volume: https://www.ahajournals.org/doi/full/10.1161/CIRCULATIONAHA.125.078665
- Năng lượng/nước + thiết kế môi trường (không recreate ngưỡng y tế): https://standards.nasa.gov/standard/nasa/nasa-std-3001-vol-02
- Wearable/self-report: https://www.esa.int/ · https://www.csa-asc.gc.ca/eng/sciences/bio-monitor.asp

## Work Guidance

- Bám pattern có sẵn trong `src/sensors/` và `src/*Routes.ts`; không thêm dependency (zod + drizzle + eventemitter3 là đủ).
- Endpoint mở theo thiết kế demo; thêm auth chỉ khi sản phẩm đổi hướng (ghi vào root AGENTS.md trước).
- Đổi schema/DTO → cập nhật test trong `tests/` cùng lúc và refresh mục Local Contracts này.

## Verification

- `bun test` trong `apps/backend` (hoặc `bun run test` từ root). Health layer: `tests/health-observations.test.ts`. TTS/ElevenLabs key: `tests/tts.test.ts`. Speech Engine: `tests/speech-engine.test.ts` (JWT verify cross-check với SDK, registration slot set/expire/pick-latest, `runSpeechTurn` delta+done/error/abort/chunk-split, HTTP routes 400/404/200). Speech admin surface: `src/speechAdmin.test.ts` (settings repo roundtrip `speech_engine.id`, GET status 4 combos env×db, create success/bad wsUrl/unreadable id/env-shadow, probe 401/non-JSON, delete clears DB id chỉ khi match, stop/start toggle wsRunning; mọi upstream call qua stub `fetchImpl`). Offline e2e: backend standalone (`SPEECH_WS_PORT`) + scratch SSE "web" + mock WS client theo wire protocol — đã verify `init → user_transcript → đúng một `agent_response` + `is_final`, `ping → pong`, JWT sai → 401. Agent traces: `tests/agent-traces.test.ts`.
- Known pre-existing failure: `tests/readings.test.ts` fail vì bảng `readings` không nằm trong `ensureSchema` (chưa sửa vì ngoài scope); không liên quan health layer.
- Smoke: `SKY_DB_PATH=<tmp> PORT=3299 bun run src/server.ts` rồi `curl /api/health/performance/ayla-reyes` — seed phải tạo 11 series × 35 row.

## Child DOX Index

Không có child — `src/` và `tests/` là boundary nội bộ của package này.
