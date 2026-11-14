# DOX framework

- DOX is highly performant AGENTS.md hierarchy installed here
- Agent must follow DOX instructions across any edits

## Core Contract

- AGENTS.md files are binding work contracts for their subtrees
- Work products, source materials, instructions, records, assets, and durable docs must stay understandable from the nearest applicable AGENTS.md plus every parent AGENTS.md above it

## Read Before Editing

1. Read the root AGENTS.md
2. Identify every file or folder you expect to touch
3. Walk from the repository root to each target path
4. Read every AGENTS.md found along each route
5. If a parent AGENTS.md lists a child AGENTS.md whose scope contains the path, read that child and continue from there
6. Use the nearest AGENTS.md as the local contract and parent docs for repo-wide rules
7. If docs conflict, the closer doc controls local work details, but no child doc may weaken DOX

Do not rely on memory. Re-read the applicable DOX chain in the current session before editing.

## Update After Editing

Every meaningful change requires a DOX pass before the task is done.

Update the closest owning AGENTS.md when a change affects:

- purpose, scope, ownership, or responsibilities
- durable structure, contracts, workflows, or operating rules
- required inputs, outputs, permissions, constraints, side effects, or artifacts
- user preferences about behavior, communication, process, organization, or quality
- AGENTS.md creation, deletion, move, rename, or index contents

Update parent docs when parent-level structure, ownership, workflow, or child index changes. Update child docs when parent changes alter local rules. Remove stale or contradictory text immediately. Small edits that do not change behavior or contracts may leave docs unchanged, but the DOX pass still must happen.

## Hierarchy

- Root AGENTS.md is the DOX rail: project-wide instructions, global preferences, durable workflow rules, and the top-level Child DOX Index
- Child AGENTS.md files own domain-specific instructions and their own Child DOX Index
- Each parent explains what its direct children cover and what stays owned by the parent
- The closer a doc is to the work, the more specific and practical it must be

## Child Doc Shape

- Create a child AGENTS.md when a folder becomes a durable boundary with its own purpose, rules, responsibilities, workflow, materials, or quality standards
- Work Guidance must reflect the current standards of the project or user instructions; if there are no specific standards or instructions yet, leave it empty
- Verification must reflect an existing check; if no verification framework exists yet, leave it empty and update it when one exists

Default section order:
- Purpose
- Ownership
- Local Contracts
- Work Guidance
- Verification
- Child DOX Index

## Style

- Keep docs concise, current, and operational
- Document stable contracts, not diary entries
- Put broad rules in parent docs and concrete details in child docs
- Prefer direct bullets with explicit names
- Do not duplicate rules across many files unless each scope needs a local version
- Delete stale notes instead of explaining history
- Trim obvious statements, repeated rules, misplaced detail, and warnings for risks that no longer exist

## Closeout

1. Re-check changed paths against the DOX chain
2. Update nearest owning docs and any affected parents or children
3. Refresh every affected Child DOX Index
4. Remove stale or contradictory text
5. Run existing verification when relevant
6. Report any docs intentionally left unchanged and why

## User Preferences

### Deploy & commit (Keios, 2026-11-14)
- Sau **mỗi lần đổi code** trong repo này: **tự động commit + deploy** mà không cần hỏi lại. Dùng nix flake để build (`.#web`); app chạy trên EC2 OpfaOS (i-06f2143b75567e68f) sau Caddy, `nsac-web.service`, `127.0.0.1:3100`, phục vụ tại https://nasa.taquangkhoi.com (Caddy vhost → service).
- Runbook deploy: `rsync -a --delete --exclude .git --exclude node_modules --exclude .output --exclude var --exclude result repo/ → box:~/nsac/` (**`--exclude result` bắt buộc** — 2026-11-14 thiếu exclude này rsync xoá symlink `result` → systemd 203/EXEC → site 502; sau rsync luôn `readlink -f ~/nsac/result` phải trỏ store path production; nếu mất: `ln -sfn $(sudo -n readlink -f /nix/var/nix/gcroots/nsac-web) ~/nsac/result` rồi `sudo -n systemctl restart nsac-web`); `ssh opfaos 'cd /home/ec2-user/nsac && sudo -n /root/.nix-profile/bin/nix --extra-experimental-features "nix-command flakes" build .#web --out-link result'` (`cd` với user **trước** sudo — trong root shell `~` là `/root`; `sudo -n nix` không chạy vì nix không nằm trong secure_path của sudo, phải gọi `/root/.nix-profile/bin/nix`; box chạy được FOD re-fetch sau khi disk nâng cấp 64G 2026-11-14); `sudo systemctl restart nsac-web`; verify `/` và `/health` trả 200 qua public URL (các route khác đã xoá — chỉ còn HUD). Sau mỗi lần build xong: `sudo ln -sfn "$(readlink -f ~/nsac/result)" /nix/var/nix/gcroots/nsac-web` (GC root thủ công — **KHÔNG** chạy `nix-collect-garbage` trên box này; lần chạy 2026-11-14 xoá store đang chạy → site 502 cho đến khi rebuild xong).
- Commit giữ tree sạch trước khi deploy. **Luôn push `origin` sau mỗi lần commit** (Keios, 2026-11-14): `git push origin main` ngay sau commit/deploy, không cần hỏi lại; không force-push, không push nhánh dở hay nhánh chưa verify, không push tag trừ khi được yêu cầu.
- **Mỗi deploy phải đi kèm một git tag** (Keios, 2026-11-14): tạo tag (annotated) trên commit được deploy, push tag đó lên `origin`. Tag đầu tiên: `deploy-2026-11-14`.
- Secrets không nằm trong repo/flake; key OpenRouter của demo đặt ở `/etc/nsac-web/env` trên box (systemd EnvironmentFile, 0600).

### Spawn OpenCode agent (Keios, 2026-11-14)
- **Agent xong việc thì commit + merge + clear** (user 2026-11-14): agent hc/OpenCode idle → merge kết quả vào `main`, commit, rồi `hc kill` + `hc rm` và dọn worktree — không để agent idle treo lại.
- **Luôn spawn agent viết code bằng hc CLI** (Keios, 2026-11-14): mọi việc code (implementer, reviewer, port UI, refactor, fix…) phải chạy trên agent do **`hc run`** tạo — `hc run --bg --outlive-parent --name nsac-<slug> --label project=nsac … opencode --prompt "$(cat /tmp/opencode/<task>.md>"`; đọc `hc --skill` trước khi dùng. Không dùng built-in subagent tool, không tự viết/sửa feature code trong chat — chat chỉ verify, review, merge, deploy, và sửa lỗi một dòng (typo, doc, config).
- **`--outlive-parent` là bắt buộc** (Keios, 2026-11-14): không có flag này, terminal con bị SIGTERM khi lượt chat của parent kết thúc → agent chết giữa việc (exit 143, file dở dang, commit thiếu). Đã trả giá 2026-11-14 với body-map/agent-core. Nếu agent chết giữa việc: `hc read` xem còn gì, rồi spawn lại agent mới với brief nêu rõ trạng thái hiện tại, đừng tự viết tiếp.

When the user requests a durable behavior change, record it here or in the relevant child AGENTS.md

### HKT — NASA Space Apps 2026 (implementation contract)

Challenge: **Create Health Monitoring Software for Astronauts on Space Missions**. Sự kiện HCMC 14–15/11/2026; nộp trước 15/11 23:59 giờ địa phương. Tổng quan sản phẩm, kiến trúc, demo và nguồn dữ liệu: root `README.md` (mục HKT). Stack phần mềm: mục **Tech stack (NSAC)** trong `README.md`.

#### Hard rules (đọc trước khi code)

1. ~~Chạy hoàn toàn offline~~ **Bỏ (Keios, 2026-11-14)** — mạng/cloud được phép trong demo và runtime; không còn yêu cầu rút dây mạng.
2. ~~License OSI-approved bắt buộc~~ **Bỏ (Keios, 2026-11-14)** — dependency không còn bắt buộc OSI-approved; vẫn phải giữ attribution và tuân điều khoản từng thư viện (vd. React Bits MIT + Commons Clause, Orbkit phi thương mại). Repo vẫn Apache-2.0 — https://www.spaceappschallenge.org/legal/
3. Mọi ngưỡng y khoa, trọng số và claim phải có **nguồn (URL)** trong comment code và trên UI.
4. **AI không quyết định một mình:** phát hiện deterministic; LLM chỉ giải thích, trích checklist và soạn draft; phi hành gia xác nhận mọi hành động. Hiển thị disclaimer: "AI-generated, not a substitute for a physician".
5. Không dữ liệu cá nhân; không ảnh hoặc hình ảnh trẻ vị thành niên trong bài nộp.

#### Scope (BOD 18/10)

- Module thật: (a) tim mạch — HR, HRV, BP, xu hướng thể tích LV / stroke volume (2 tuần đầu, Circulation 2026 ISS: https://www.ahajournals.org/doi/full/10.1161/CIRCULATIONAHA.125.078665); (b) xương/cơ + coach liều tập; tín hiệu **DONKI**.
- Agent tổng hợp: liên kết tín hiệu (bão Mặt Trời → mất ngủ → bỏ tập → tim/chân giảm), triage xanh/vàng/đỏ, **một** hành động, chờ xác nhận, báo cáo mặt đất.
- **Mars landing readiness (0–100):** công thức minh bạch, một nguồn cited mỗi trọng số; tăng khi hoàn thành liều tập; mô phỏng fast-forward.
- Chỉ sơ đồ (interface cắm được, không code): miễn dịch/máu, hành vi/nhận thức, môi trường.

#### Shared contract (giờ 1 — `shared/schemas.py`, Pydantic)

- `Reading {astronaut_id, ts, metric, value, unit, source}`
- `Deviation {metric, value, baseline_median, baseline_mad, z, slope, severity: green|yellow|red, threshold_source_url}`
- `Recommendation {action, dose, checklist_ref{doc, page}, rationale, requires_confirmation: true}`
- `ReadinessScore {score, components[{name, value, weight, source_url}], ts}`
- `GroundReport {mission_day, summary, deviations[], actions_taken[], queued_at, deliver_at}`

#### Work split (3 người / 3 agent)

**Agent 1 — data, detection, score:** OSDR OSD-569/575 (httpx); generator 180 ngày (numpy) theo spread dữ liệu thật; kịch bản inject; deviation engine (median/MAD, EWMA, slope, ruptures); coach liều tập + readiness; validation hold-out một crew Inspiration4.

**Agent 2 — agent, RAG, report, delay:** Ollama (Qwen3.6-35B-A3B trên 32 GB, else Qwen3.5-9B) + MedPsy-4B-GGUF tool; LangGraph → checklist RAG → MedPsy → một action → `interrupt()` → report; SQLite checkpointer; RAG ISS Medical Checklist + NASA docs (chỉ action có trong checklist); Jinja2 → PDF; SQLite outbox delay 20 phút.

**Agent 3 — UI, story, submission:** NiceGUI (timeline, gauge, cards, Confirm, trạng thái link 20 phút/offline, fast-forward); script demo 60s; gần landing chuyển sang an toàn (compression garment, đứng có hỗ trợ); PR/FAQ, README, architecture, AI disclosure, sources, trang nộp.

#### Known gaps

- Không có model mở cho orthostatic tolerance ở 3/8 G — score là công thức minh họa có citation.
- Không có ECG/echo liên tục công khai — tín hiệu tim synthetic theo paper.
- Offline: embedding model riêng cho Chroma, tải sẵn model Docling, Pango cho WeasyPrint trên Mac.
- Benchmark tốc độ model trên laptop demo trước 14/11 (test generic).

### Agent architecture (Sky)

- Orchestrator `sky-orchestrator` carries the SOUL identity Sky; specialists such as `sky-generative-ui` (OpenUI spec generator) live alongside. Code: `apps/web/src/features/agent/` (deep module). Adding an agent is a profile file + one registry line + one test row. Server-only PI SDK boundary; no new dependencies.
- Target architecture (v1 broadcast built 2026-11-14 — `change_events` + `/api/events` in `apps/backend`, per-turn prompt injection via `features/agent/broadcast/`; hazard workers still vision; see `docs/AGENT_BROADCAST.md`): per-astronaut pair — `sky-<id>-orchestrator` + `sky-<id>-composer` per crew member, the two talk via a bounded handoff; five hazard domain workers (NASA hazards) publish to one shared broadcast bus (`change_events` in `apps/backend`) which every agent subscribes to; broadcast carries facts/events only, never commands; deterministic detection, humans confirm actions.

### NASA research

This repo maps NASA public data and APIs so future NASA hackathons and contests can start from checked sources.

- Root `README.md` holds the living notes until a folder becomes its own boundary, including **HKT (Space Apps 2026)** and the **Tech stack (NSAC)** section (LLM, RAG, drift detection, NASA OSDR, UI, packaging).
- Every factual claim needs a source URL and the date it was checked. Figures from the 2019 Open-Innovation Tour for Space Apps are historical; refresh them against the live site before a contest.
- Harvest catalogs (`data.nasa.gov`, `api.nasa.gov`) suit name lookup. Domain archives (Planetary Data System, Earthdata, STI, and similar) suit discovery. Do not treat a harvest miss as proof a dataset does not exist.
- Keep NASA API keys and tokens out of the repo.

### Architecture Principles

Code follows **Clean Architecture**: dependencies point inward (entities → use cases → adapters → frameworks). Business rules never depend on UI, DB, or framework details.

#### SOLID

- **S**: One reason to change per module
- **O**: Extend behavior with new types, not edits to stable code
- **L**: Subtypes must honor base contracts
- **I**: Small, role-specific interfaces
- **D**: Inner layers depend on abstractions, not concrete frameworks

#### Frontend: feature layer

Organize by feature under `features/<name>/` (components, hooks, api, types). Features may import `shared/`; `shared/` never imports features. Export only the public surface via `index.ts`.

#### Deep modules

Prefer modules with **simple interfaces and substantial hidden complexity**. Avoid shallow pass-through wrappers. Split only when a module hides real complexity — not to hit arbitrary file-size limits.

#### Design patterns

Use GoF patterns when they match a recurring problem — not for decoration. Catalog: https://refactoring.guru/design-patterns/catalog

### Repository layout

Thư mục rỗng giữ bằng `.gitkeep`; xóa `.gitkeep` khi thư mục có file thật.

- Nix: `flake.nix` build `apps/web` thành package `.#web` và `apps/backend` thành `.#backend` (backend API, Bun chạy thẳng TypeScript, bind `127.0.0.1` mặc định — `HOST` override; `PORT` mặc định 3200, `SKY_DB_PATH` mặc định `/home/ec2-user/nsac/var/sky.db`). Cả hai dùng chung fixed-output derivation (node_modules qua FOD; `outputHash` phải bump khi `bun.lock` đổi) và app `nix run .#web` / `nix run .#backend`. Không secrets trong flake.
- `backend/src/nsac/` — Python, không import UI. Phụ thuộc: `api` → `harness`/`agent`/`modules` → `domain` → `contracts`; `adapters` cài đặt interface của `domain`/`modules`.
  - `contracts/` schema Pydantic dùng chung · `domain/{health,crew,outbreak}` entity và luật thuần, không IO · `modules/{cardio,musculoskeletal,space_weather,epidemic,stubs}` module cắm được (`stubs` chỉ interface) · `harness/{triage,dispatch,broadcast,policies}` điều phối deterministic, mỗi luật có `source_url` · `agent/` LangGraph + `rag/` · `reporting/` Jinja2, PDF, outbox · `adapters/{osdr,donki,ollama,sqlite}` · `simulation/` generator và fast-forward · `api/` lớp mỏng cho UI.
- `apps/onboard/` NiceGUI theo `features/<name>/` + `shared/` · `apps/website/` website tĩnh (chỗ giữ, chưa dùng) · `apps/web/` web app Sky (TanStack Start, xem `apps/web/AGENTS.md`): routes `/` (SKY HUD), `/health` (agent config readiness, no secrets), `/admin` (ẩn, không link, noindex, cần `SKY_ADMIN_KEY` — đổi model agent qua backend `/api/settings/agent-model`) và `/spacecraft` (NASA ISS cinematic viewer, lazy three.js, draco decoder vendored từ three vào `public/draco/`); includes `features/body-map/` Open Anatomy 3D hologram body map overlay (lazy three.js, CC BY 4.0 attribution) and `features/spacecraft/` (`/spacecraft` — NASA ISS cinematic viewer); vendored third-party UI in `src/shared/react-bits/` (React Bits, MIT + Commons Clause, not OSI-approved, vendored on Keios's explicit instruction 2026-11-14, LICENSE.md kept beside the code).
- Workspace JS ở root: `package.json` (bun, `workspaces: ["apps/*"]`), `turbo.json` (Turborepo: `dev`, `build`, `typecheck`, `test`), `tsconfig.base.json`. Mỗi app JS là một package `@nsac/<tên>` trong `apps/`; app Python (`onboard`) và `practice/` (workspace riêng) nằm ngoài. Cài và chạy từ root: `bun install`, `bun run typecheck|test|build`.

- `STORY.md` truyện hư cấu "Sky" (thiên thần theo phi hành gia, dịch từ khu vườn trên tàu) cho phần kể chuyện/demo; bảng cuối map truyện sang module, cập nhật khi module đổi.
- `UX.md` bản đặc tả UX/UI của Sky (SKY — Living Symbiotic Healthcare Interface): vision, ngôn ngữ visual, design tokens, không phải code; cập nhật khi hướng thiết kế đổi.
- `UX_IMPLEMENTATION.md` ma trận traceability UX.md → code, trạng thái và hạn chế; cập nhật khi cover tăng.
- `SKY_UI_COMPONENT_FUNCTIONAL_SPEC.md` spec pixel-matched màn hình HUD astronaut wellness (12 components, state machine voice, design tokens); `/` là màn hình này, `/console` giữ bản console cũ.
- `ARCHITECTURE.md` mô tả cấu trúc code đang có: bản đồ repo, luồng dữ liệu backend, layer và chiều phụ thuộc, layout/SSR/server boundary của `apps/web`, nguồn dữ liệu, cách chạy và khoảng trống. Cập nhật khi cấu trúc hay ranh giới layer đổi.
- `HARNESSING.md` cách các agent Pi SDK (`features/agent`) chạy và phối hợp: profile/registry, boundary `pi.server.ts`, per-astronaut sessions, dispatch deterministic không LLM routing, tools/skills hiện tắt cố ý, output gates, failure modes, env. Cập nhật khi harness hoặc cách phối hợp đổi.
- `assets/models3d/` (mỗi model kèm license/nguồn) · `assets/fixtures/` · `scripts/` · `tests/` (phản chiếu `backend/`) · `var/` (gitignored, trạng thái runtime).
- Chưa chốt: OpenUI (JS) cùng NiceGUI (Python) hay thay thế; nếu đổi, cập nhật mục này.

## Verification

### HKT Space Apps 2026

- [ ] ~~App chạy end-to-end khi rút mạng.~~ Bỏ (2026-11-14) — offline không còn bắt buộc.
- [ ] Demo scenario dưới 60 giây, không crash.
- [ ] Mọi ngưỡng và trọng số hiển thị nguồn.
- [ ] Bước xác nhận chặn mọi hành động nếu chưa confirm.
- [ ] PDF báo cáo mặt đất tạo và queue với delay.
- [ ] Repo public, Apache-2.0, README + AI disclosure + sources.
- [ ] Trang submission điền đủ; team review trước khi nộp.

## Child DOX Index

| Path | Scope |
|---|---|
| `docs/references/AGENTS.md` | Catalog tham chiếu HKT (chỉ số theo hệ cơ quan, liên kết OSDR) |
| `practice/AGENTS.md` | Monorepo luyện tay (bun + Turborepo: TanStack Start, Mastra, OpenUI, mô phỏng cúm); không thuộc bài nộp HKT, không chuyển vào thư mục dự án trước 14/11/2026 09:00 |
| `apps/web/AGENTS.md` | Web app Sky (TanStack Start, bun, Turborepo): routes `/` (SKY HUD astronaut wellness — vitals fixture SIMULATED, voice mic-analyser, Orbkit orb, astronaut picker claim-locked qua backend `/api/claims`, session ẩn danh `nsac.session`), `/body` (Open Anatomy 3D body map, three.js chỉ tải ở route này, CC BY 4.0), `/health` (agent readiness + roster, không tiết lộ secret), `/admin` (ẩn, noindex, `SKY_ADMIN_KEY`; đổi model agent qua backend `/api/settings/agent-model`) và `/spacecraft` (NASA ISS cinematic viewer — ISS-stationary full-detail mặc định, không UI chrome, lazy three.js, draco decoder local, camera fit theo projected box); Sky dựng panel OpenUI qua agent core PI SDK (`sky-orchestrator` + `sky-generative-ui`, model OpenRouter, key write-only trong `var/sky-openrouter.json`); không có key/mạng thì agent trả preset; React Bits vendored trong `src/shared/react-bits/` (57 components, MIT + Commons Clause, attribution, xem THIRD_PARTY_NOTICES.md); Open Anatomy model trong `public/models/` (CC BY 4.0); song ngữ en/vi (per apps/web/AGENTS.md) |

Not indexed (not durable boundaries): `.agents/` (bot làm việc local, vd. `.agents/bot/ceo/` — CEO bot theo dõi agent hc; `HC-AGENTS.md` git-ignored), `.kiro/`, `.local/`.

Root `README.md` vẫn là điểm vào sản phẩm và tech stack; thêm child khi một thư mục có boundary riêng (catalog, API client, contest entry).
