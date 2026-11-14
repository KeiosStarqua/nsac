# Kiến trúc agent mục tiêu — per-astronaut pairs, hazard workers, broadcast/shared memory

**Trạng thái:** vision — chưa build (ghi nhận 2026-11-14 theo chỉ đạo của Keios). Không thuộc phạm vi nộp HKT 14–15/11. Tài liệu này định vị hướng đi dài hạn và các điểm nối vào code hiện có; mọi phần "hiện có" nêu dưới đây đã được verify trước khi ghi.

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
| Per-astronaut orchestrator pair | Chat per-astronaut OK; `sky-orchestrator`/`sky-generative-ui` là profile global | Profile theo từng astronaut + per-astronaut composer session (`var/sky-sessions/<id>.hud.jsonl`) — đang triển khai trong `?gen=1` hud-gen |
| Hai agent nói chuyện | `askSky()` dispatch 1 chiều (regex `routeRequest` → composer → validate) | Hội thoại có giới hạn: orchestrator hỏi composer, nhận program, tiếp tục (maxSteps) — bước sau hud-gen |
| Composer per-astronaut | Compose cache theo locale, session dùng chung | Session riêng từng astronaut (đang triển khai) |
| Broadcast / shared memory | Không có | Thiết kế ở trên; code sau submission nếu cần |
| 5 hazard workers | Không có | Sau hackathon; chỉ dựng interface + một worker mẫu trước |

## Ngoài phạm vi / thứ tự đề xuất
1. `?gen=1` HUD OpenUI (đang làm) — dựng nền: per-astronaut composer, preset deterministic, validate + fallback.
2. Chat orchestrator ↔ composer nói chuyện thật (orchestrator quyết định gọi composer trong một lượt, có giới hạn).
3. Bảng `change_events` + `processed_events` trong `apps/backend`; `EventBus` interface; demo một topic end-to-end (vd fixture vitals đổi → Sky panel tự compose lại).
4. Một hazard worker thật (cardio hoặc radiation) trên pipeline hiện có; sau đó copy ra 5.
5. Tách mỗi worker một host; giám sát; replay từ log.

## Ràng buộc không được phá
- AI không quyết định một mình; worker phát hiện deterministic, mọi action qua Confirm.
- Mọi ngưỡng/trọng số có URL nguồn (comment code + UI).
- Broadcast chỉ mang facts/events; không mệnh lệnh; không dữ liệu cá nhân thật; roster crew là hư cấu.
