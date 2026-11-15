# apps/backend — Sky backend API

## Purpose

HTTP API của Sky cho box demo single-node: Bun chạy thẳng TypeScript, Drizzle trên `bun:sqlite`, không auth (demo). Cung cấp crew/claims, broadcast events, sensors + telemetry WS, settings, và health observation layer (năng lượng/cơ/giấc ngủ/nước) cho `apps/web`.

## Ownership

- Package này sở hữu `/health`, `/api/astronauts`, `/api/claims`, `/api/events` + `/api/cursors`, `/api/sensors/*` + `/ws/telemetry`, `/api/settings/agent-model` + `/api/settings/agent-models`, `/api/health/*`.
- Không sở hữu UI: `apps/web` là consumer. Không import lẫn với backend Python `backend/src/nsac/` (layer khác, contract riêng).
- `tests/` phản chiếu module trong `src/`; fixture DB đi qua `SKY_DB_PATH` tmp (`tests/settings-agent-models.test.ts` cover route mới).

## Local Contracts

### DB ownership

- `src/db/client.ts` là connection chính (`db`): `astronauts`, `astronaut_claims`, `app_settings`, `health_observations`. `ensureSchema()` tạo bảng + index idempotent; repo không có lịch sử migration nên không chạy `drizzle-kit generate`/`push`, DDL ở `ensureSchema` là nguồn sự thật.
- Connection riêng (cùng `SKY_DB_PATH`): `claimsClient`, `eventsClient`, `sensorsClient`, `settingsClient`. Lý do: `bun test` chia sẻ module cache trong một process, file test cần DB riêng phải bind qua connection riêng trước khi module load.
- Thêm bảng: schema `src/db/schema/<name>.ts` + export ở `schema/index.ts` + DDL/index trong `ensureSchema` + repo ở `src/db/repositories/`. Không sửa/xoá block `ensureSchema` của bảng cũ.
- `health_observations` dùng chung `db` như `readingsRepo` — không mở connection thứ ba (một writer, WAL).

### Routes

- `/api/settings/agent-model` (legacy): `GET` → `{ model, updatedAt }`; `PUT { model }` (MODEL_ID_REGEX, trim) → upsert. Giữ nguyên hành vi cho back-compat; box deploy sau đổi web nên chạy được cả hai.
- `/api/settings/agent-models`: `GET` → `{ provider, model, models, updatedAt }`
  (`provider`/`models` null khi chưa set, `model` = legacy raw, `updatedAt` = max của 2 key mới hoặc null).
  `PUT { provider?, model?, models? }` — mỗi field optional, `null` = xoá key tương ứng; `models` là thay thế
  **toàn bộ** map `{profileId: modelId}` (`{}`/null xoá key): keys `^[a-z0-9-]{1,64}$`, ≤16 entries, values MODEL_ID_REGEX;
  provider enum strict `opencode-go|openrouter`. Mọi field ghi trong **một** transaction.
  DB keys: `agent.provider`, `agent.models` (JSON string) trong `app_settings`.

- Handler dạng `handleXRequest(req): Promise<Response | null>`; trả `null` khi path/method không thuộc module để `server.ts` fall-through về 404. Thứ tự wire trong `server.ts`: claims → settings → events → sensors → health → astronauts.
- Lỗi luôn JSON `{ ok: false, error }` với 400/404/409/413. Đọc body có cap `Content-Length` + kiểm tra lại sau khi đọc (xem `eventsRoutes.ts`).
- `GET /api/health/performance/:astronautId` → `{ astronautId, asOf, metrics[], derived }`: mỗi metric có `latest`, `delta30d` (latest − điểm cũ nhất trong 30 điểm), `points` 30 giá trị tăng dần, `baseline`, `method`, `quality`, `source`. 404 `unknown_astronaut`; 400 `bad_astronaut`; astronaut chưa có data → 200 `metrics: []`, `derived: {}`.
- `GET /api/health/observations?astronautId=&metric=&limit=` → mảng row thô mới nhất trước (`ts DESC`), `limit` 1..500 (mặc định 500), query sai → 400 `bad_query`. `energy_balance` không nhận làm `metric` (derived).
- Query/param validate bằng zod ở `src/healthSchemas.ts` (query) và `src/sensors/routes.ts` (body).

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

- `bun test` trong `apps/backend` (hoặc `bun run test` từ root). Health layer: `tests/health-observations.test.ts`.
- Known pre-existing failure: `tests/readings.test.ts` fail vì bảng `readings` không nằm trong `ensureSchema` (chưa sửa vì ngoài scope); không liên quan health layer.
- Smoke: `SKY_DB_PATH=<tmp> PORT=3299 bun run src/server.ts` rồi `curl /api/health/performance/ayla-reyes` — seed phải tạo 11 series × 35 row.

## Child DOX Index

Không có child — `src/` và `tests/` là boundary nội bộ của package này.
