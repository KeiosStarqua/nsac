# Kiến trúc agent mục tiêu — per-astronaut pairs, hazard workers, broadcast/shared memory

**Trạng thái:** v1 (shared memory, single box) đã build — xem mục "Trạng thái 2026-11-14" ở cuối. Phần còn lại (hazard workers, broker, push) vẫn là vision; tài liệu định vị hướng đi dài hạn và các điểm nối vào code hiện có.

## Hình dạng tổng thể

```
┌───────────────────────────── mỗi phi hành gia (6 crew) ──────────────────────────────┐
│  sky-<id>-orchestrator   ←→ Sky-chat, trả lời plain text (SOUL Sky)                  │
│  sky-<id>-composer       ←→ sinh OpenUI Lang, panel riêng của người đó               │
│  Hai agent nói chuyện với nhau qua handoff có giới hạn (maxSteps, không vô hạn).      │
└───────────────┬─────────────────────────────────────────────────────────────────────┘
                │ subscribe
┌───────────────▼─────────────────────────────────────────────────────────────────────┐
│  BROADCAST (shared memory)  —  bảng `change_events` (apps/backend, bun:sqlite, WAL)   │
│  mọi worker nộp "tín hiệu đã kết luận" lên đây; mọi agent đọc lại qua subscribe.     │
└───────┬───────────┬───────────┬───────────┬───────────┬───────────────────────────┘
        │           │           │           │           │
   ┌────▼───┐  ┌────▼───┐  ┌────▼────┐  ┌────▼────┐  ┌───▼──────────────┐
   │radiation│  │ bones  │  │ cardio  │  │ environ │  │ isolation/be-    │  ← 5 hazard
   │ worker  │  │ worker │  │ worker  │  │ worker  │  │ haviour worker   │    domain workers
   └────────┘  └────────┘  └─────────┘  └─────────┘  └──────────────────┘
```

## Các lớp

### 1. Per-astronaut pair (đã có một phần)
- Chat đã per-astronaut: PI SDK `SessionManager` riêng từng `astronautId`, transcript `var/sky-sessions/<id>.jsonl`, `var/sky-sessions/<id>.json`.
- **Mục tiêu:** mỗi phi hành gia một *cặp* agent — orchestrator `sky-<id>-orchestrator` (biến thể của profile `sky-orchestrator`, gắn astronaut context) + composer `sky-<id>-composer` (biến thể của `sky-generative-ui`, sinh OpenUI cho panel riêng của người đó). Không dùng chung session giữa hai agent; mỗi agent một session riêng.
- Hai agent trao đổi với nhau qua handoff của orchestrator → composer, giới hạn số bước (`maxSteps`), composer không tự gọi lại orchestrator (tránh vòng lặp).
- Hiện thực theo profile + registry (`features/agent/agents/`): thêm profile file + một dòng registry + một test row mỗi agent/cặp.

### 2. Năm hazard domain workers
Theo 5 mối nguy của NASA (radiation, reduced-gravity/xương-cơ, isolation & confinement/hành vi, distance from Earth, hostile & closed environment):
- Mỗi worker quản một hazard, sở hữu *pipeline tín hiệu của hazard đó* (đó là nơi chứa ngưỡng NASA-STD-3001 / NASA allowances có nguồn).
- Worker **chỉ phát hiện + kết luận + nộp broadcast**; không có quyền hành động. Mọi action vẫn qua Confirm của phi hành gia (luật HKT số 4).
- Triển khai dài hạn: mỗi worker một tiến trình/host riêng ("máy trần riêng"), không nhét vào web app.
- Interim: khi cần, một worker có thể chạy như một PI SDK session phía server với SOUL riêng, tool = deterministic checks đã có nguồn; phát hiện luôn deterministic, LLM chỉ tóm tắt.

### 3. Broadcast / shared memory
- **Một bus chung duy nhất.** Nơi đặt tự nhiên là `apps/backend` (bun:sqlite, Drizzle, WAL) — sẵn sàng cho single-box; nếu sau này multi-machine, thay bảng bằng broker (NATS/Redis) sau cùng một interface `EventBus`.
- Bảng đề xuất: `change_events(id INTEGER PK, astronaut_id TEXT NULL, topic TEXT, source TEXT, payload JSON, created_at INTEGER)` và `processed_events(event_id, agent_id, processed_at)` cho idempotency của consumer.
- **Topic**: `vitals.updated`, `hazard.radiation.alert`, `hazard.bones.alert`, `claims.changed`, `session.phase`, … — enum + zod payload, không string tự do.
- **Giao thức**: publish tại-least-once + consumer idempotent (dedupe theo `event_id`); giữ thứ tự theo `(astronaut_id, seq)`; broadcast là *facts/events*, không phải mệnh lệnh — không có lệnh "làm X" bắn vào agent từ bus.
- **Ai đọc gì**: mỗi cặp orchestrator/composer subscribe topic liên quan; phần trả lời của Sky luôn chiếu được về `crew_state` (bảng facts chung: giá trị fixture/ghi từ pipeline, nguồn theo từng fact).
- **Không** dùng LLM làm router của bus; dispatch theo topic (deterministic), LLM chỉ được gọi *sau* khi đã lọc đúng sự kiện.

## Mapping vào code hiện có

| Mục tiêu | Hiện có (verify 2026-11-14) | Cần làm |
|---|---|---|
| Per-astronaut orchestrator pair | Chat per-astronaut OK; `sky-orchestrator`/`sky-generative-ui` là profile global | Profile theo từng astronaut + per-astronaut composer session (`var/sky-sessions/<id>.hud.jsonl`) — đang triển khai trong hud-gen (`/`) |
| Hai agent nói chuyện | `askSky()` dispatch 1 chiều (regex `routeRequest` → composer → validate) | Hội thoại có giới hạn: orchestrator hỏi composer, nhận program, tiếp tục (maxSteps) — bước sau hud-gen |
| Composer per-astronaut | Compose cache theo locale, session dùng chung | Session riêng từng astronaut (đang triển khai) |
| Broadcast / shared memory | v1 đã build 2026-11-14 (xem mục "Trạng thái 2026-11-14") | Workers, broker, push — sau submission |
| 5 hazard workers | Không có | Sau hackathon; chỉ dựng interface + một worker mẫu trước |

## Ngoài phạm vi / thứ tự đề xuất
1. `/` HUD OpenUI (mặc định từ 2026-11-14) — dựng nền: per-astronaut composer, preset deterministic, validate + fallback.
2. Chat orchestrator ↔ composer nói chuyện thật (orchestrator quyết định gọi composer trong một lượt, có giới hạn).
3. Bảng `change_events` + `processed_events` trong `apps/backend`; `EventBus` interface; demo một topic end-to-end (vd fixture vitals đổi → Sky panel tự compose lại).
4. Một hazard worker thật (cardio hoặc radiation) trên pipeline hiện có; sau đó copy ra 5.
5. Tách mỗi worker một host; giám sát; replay từ log.

## Ràng buộc không được phá
- AI không quyết định một mình; worker phát hiện deterministic, mọi action qua Confirm.
- Mọi ngưỡng/trọng số có URL nguồn (comment code + UI).
- Broadcast chỉ mang facts/events; không mệnh lệnh; không dữ liệu cá nhân thật; roster crew là hư cấu.

## Trạng thái 2026-11-14 — v1 đã build
Đã có (single box, `apps/backend` + `apps/web`):
- Bảng `change_events` (+ index `(astronaut_id, id)`, `(topic, id)`) và `consumer_cursors` trong SQLite (WAL, idempotent `ensureSchema` ở `src/db/eventsClient.ts`); payload zod-strict theo topic, POST body ≤ 8 KB.
- HTTP API: `POST /api/events` (endpoint mở, demo — documented as such), `GET /api/events?cursor=&limit=&astronautId=&topics=` (NULL-scoped global visible cho mọi astronaut; rows có `astronaut_id` chỉ của chính người đó), `GET|POST /api/cursors/:consumerId` (monotonic).
- Prompt injection mỗi turn ở orchestrator (`sky-chat`, consumer `<id>-orchestrator`) và composer (`sky-hud-composer`, consumer `<id>-composer`): block `[SHARED CONTEXT — …]` chỉ chứa topic `hazard.detected`/`health.fact.updated`/`claims.changed` (không bao giờ `agent.turn.completed`), tối đa 10 dòng/1200 ký tự, ghép SAU tin nhắn user. Bất kỳ failure nào → không có block, turn vẫn chạy.
- Per-astronaut cursors (at-least-once, `setCursor` best-effort, monotonic); publish `claims.changed` khi claim thành công và `agent.turn.completed` sau mỗi turn (chat + composer).
- Bus in-process `EventEmitter3` (`eventsBus.emit("published", …)`); `server.ts` đăng ký đúng một listener log `[events] <id> <topic>` ra stdout — quan sát được nhưng không điều khiển gì.
- Wire-mirror zod schemas ở `apps/web/src/features/agent/broadcast/model/events.ts` (pure, không IO, full unit tests) + `runtime/backend.ts` (fetch với timeout 1500ms, `setBackendFetch` test hook) + `runtime/shared-context.ts` (`sharedEventsBlock`).

Cố ý CHƯA có (vẫn là vision): 5 hazard worker, NATS/Redis hay multi-machine, push/websocket delivery, agent-to-agent dialogue ngoài dispatch hiện có, `processed_events`/dedupe phía consumer (v1 dựa vào cursor), `vitals.updated`/`session.phase` topic, claim reset event từ web, UI surface nào cho broadcast.
