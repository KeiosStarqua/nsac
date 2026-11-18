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

### Build, test, deploy — không tự chạy (Keios, 2026-11-17)
- Agent tại root này (chat session, hc/OpenCode agents, CEO, mọi agent được spawn) **KHÔNG BAO GIỜ tự chạy build, test hay deploy** — kể cả "chạy nhanh để verify" trước khi commit/merge hay báo xong việc. Cấm: `bun run build`, `bun run test`, `turbo build|test`, `nix build`, `scripts/deploy.sh`, `scripts/nix-gc.sh`, restart service trên box, hay bất kỳ lệnh nào build artifact / chạy test suite / đụng production — trừ khi Keios cho phép rõ ràng trong chat cho lệnh đó.
- Build/test/deploy chỉ do **Keios**, hoặc **ops (`.agents/bot/ops`)** chạy theo entry trong `.agents/bot/ops/OPS.md` (git-bot ghi entry sau push: mặc định `test+deploy`, TREE commit `test`; deploy chỉ sau test pass). Git-bot (`.agents/bot/git`) chỉ merge+push, không tự chạy build/test/deploy. Agent chỉ sửa code/doc, review bằng diff, commit + push theo luật commit — rồi khi cần build/test, **ghi yêu cầu vào `.agents/bot/ops/OPS.md`** (xem dưới), không tự chạy lệnh.
- **Agent trong git worktree muốn verify → yêu cầu qua `OPS.md`** (Keios, 2026-11-17): không chạy `bun run build|test`, `turbo`, `nix build`, `scripts/deploy.sh`… trên máy của mình. Nối vào **cuối** `/home/keios/repos/mein/nsac/.agents/bot/ops/OPS.md` — **đường dẫn tuyệt đối** (file local-only, git-ignored nên KHÔNG có trong worktree; đừng tạo bản mới trong worktree của bạn) — tạo file nếu chưa có, với entry:

  ```
  ## <sha-12> — queued
  - Status: queued
  - Sha: <tip sha của nhánh worktree>    (hoặc Branch: <tên nhánh> — ops resolve tip)
  - Request: test                          (KHÔNG bao giờ test+deploy)
  - Source: worktree-agent
  - Requester: <name/label agent, vd. nsac-<slug>>
  - Queued: <ts>
  - Log: logs/<sha-12>.log
  - Result: (chưa chạy)
  - Notes: <một dòng: cần gì — build / typecheck / test>
  ```

  Luật khi ghi: chỉ `Request: test` — **deploy bao giờ cũng chỉ qua git-bot/Keios**; nối vào cuối, không sửa/xoá entry của người khác, không tự sửa `Status`/`Result` của entry mình (ops ghi); nếu bị chặn `failed` thì báo Keios, không tự xử. Đọc kết quả từ `OPS.md` sau khi ops chạy xong (hoặc Keios báo). Mỗi lần push commit mới cần test lại → ghi entry mới, đừng sửa entry cũ.
- Nếu một việc bắt buộc phải chạy build/test để hoàn thành, dừng lại và hỏi Keios trước; không tự quyết.
- "Verify" ở mọi luật khác trong file này = đọc diff / review code, không phải chạy build hay test.

### Deploy & commit (Keios, 2026-11-14)
- Deploy chỉ được phép chạy bởi **ops (`.agents/bot/ops`)** (Keios, 2026-11-17; thay luật git-bot 2026-11-16): agent tại repo root `/home/keios/repos/mein/nsac` (hc agents, CEO, mọi session khác, **kể cả git-bot**) **KHÔNG được deploy** — deploy chỉ khi ops chạy theo entry `test+deploy` trong `.agents/bot/ops/OPS.md`, **sau khi sha đó test pass** (`scripts/deploy.sh <sha>`). Mọi nhánh merge lên `origin/main` kết thúc bằng deploy do ops chạy; không nhờ agent/bot khác chạy hộ.
- Sau merge lên `origin/main`, **git-bot ghi entry `test+deploy` vào `.agents/bot/ops/OPS.md`** → ops lần lượt test từng sha (build → typecheck → test) → test pass thì deploy ngay (luật này áp dụng cho luồng git-bot → ops; chat/hc agent KHÔNG tự deploy — xem mục Build/test/deploy phía trên). **Mặc định: merge xong là deploy ngay** (Keios 2026-11-16, khẳng định lại luật 2026-11-14; thực thi qua ops 2026-11-17): mọi lượt merge lên `origin/main` kết thúc bằng deploy do ops chạy (`scripts/deploy.sh <sha>`, tag tự động) **không cần chờ Keios chốt**, kể cả các nhánh từng ghi "HELD" trước đó. Chỉ KHÔNG deploy khi nhánh/registry có lệnh cấm deploy rõ ràng (vd. `KHÔNG deploy` trong BRANCHES.md — khi đó git-bot ghi `Request: test`), hoặc khi sha không test pass (ops dừng hàng, báo Keios). Dùng nix flake để build (`.#web`); app chạy trên EC2 OpfaOS (i-06f2143b75567e68f) sau Caddy, `nsac-web.service`, `127.0.0.1:3100`, phục vụ tại https://nasa.taquangkhoi.com (Caddy vhost → service).
- Runbook deploy — **mọi deploy chạy qua `scripts/deploy.sh`** (Keios 2026-11-14): `scripts/deploy.sh` (mặc định origin/main, hoặc `--dry-run` / `<ref>` / `--no-tag` / `--no-gc`; `--help`). Script mã hoá toàn bộ runbook từng thủ công này: worktree sạch @ ref → `git submodule update --init` (+ LFS) → rsync với excludes cố định (`.git node_modules .output .turbo var result result-backend result-node-modules result-inference .venv`) → trên box build `.#web`, `.#backend`, `.#nodeModules` riêng → pin 4 gcroots **trực tiếp store path** (`sudo ln -sfn "$(readlink -f ~/nsac/result[-backend|-node-modules|-inference])" /nix/var/nix/gcroots/nsac-{web,backend,web-node-modules,inference}`) → restart web/backend → stage inference (build `.#inference` + gcroot + bootstrap-or-restart `nsac-inference.service` + `curl 127.0.0.1:8100/health`; box/ssh/sudo lỗi ⇒ cảnh báo to + bỏ qua, health hỏng trên unit đã chạy ⇒ `journalctl -n 40` + exit 1, không tag) → `scripts/nix-gc.sh` (fail-closed cho cả 4 root; `check_unit_execstart` resolve ExecStart qua out-link `~/nsac/result*` rồi so prefix với gcroot) → verify 12 route/asset 200 → annotated tag `deploy-YYYY-MM-DD[-N]` push origin (chỉ khi origin/main == ref). Bài học 2026-11-14 (rsync xoá result-backend → gcroot lủng lẳng → GC xoá backend → 203/EXEC; thiếu submodule → `/data` 500; FOD stale → vite không resolve hugeicons; GC xoá FOD node_modules — build-time input không runtime reference → deploy sau rebuild hash lệch) đều được encode trong script — sửa script là sửa luôn vận hành cho mọi deploy sau này. **KHÔNG gõ rsync/nix/symlink bằng tay**; chỉ sửa runbook bằng cách sửa script rồi verify một deploy thật. Nếu deploy fail-closed giữa chừng: đọc route lỗi, fix nguyên nhân (thường là FOD hash stale — bump `flake.nix` `outputHash`: x86_64 local fakeHash trick + aarch64 trên box cùng cách), chạy lại script; `~/nsac/result[-backend]` chỉ do script sửa (nix build `--out-link`), không `ln` tay. Sau deploy: GC qua gcroots an toàn; KHÔNG dùng `nix-collect-garbage` ngoài gcroots. Khi `scripts/nix-gc.sh` TỪ CHỐI chạy nghĩa là gcroots không trỏ store path trực tiếp — sửa bằng `ln -sfn "$(readlink -f ...)"` rồi chạy lại.
- Commit giữ tree sạch trước khi deploy. **Luôn push `origin` sau mỗi lần commit** (Keios, 2026-11-14): `git push origin main` ngay sau commit/deploy, không cần hỏi lại; không force-push, không push nhánh dở hay nhánh chưa review, không push tag trừ khi được yêu cầu.
- **Mỗi deploy phải đi kèm một git tag** (Keios, 2026-11-14): tạo tag (annotated) trên commit được deploy, push tag đó lên `origin`. Tag đầu tiên: `deploy-2026-11-14`.
- Secrets không nằm trong repo/flake; key OpenCode Go của demo (`OPENCODE_API_KEY` hoặc `SKY_OPENCODE_API_KEY`) đặt ở `/etc/nsac-web/env` trên box (systemd EnvironmentFile, 0600); `SKY_OPENROUTER_API_KEY` chỉ còn cho nhánh legacy; `AWS_BEARER_TOKEN_BEDROCK` (+ `AWS_REGION=ap-southeast-1`) khi chạy provider `amazon-bedrock`.

### Spawn OpenCode agent (Keios, 2026-11-14)
- **Mọi agent chạy trên root này PHẢI spawn trong một git worktree riêng, không chạy trực tiếp trong shared root checkout** (Keios, 2026-11-16): shared tree có thể chứa WIP của phiên khác nên agent dễ đè lên hoặc commit nhầm. Quy trình: tạo worktree sạch (`git worktree add /home/keios/nsac.worktrees/<slug> -b <slug>` hoặc `../nsac-<slug>` sibling) → `git submodule update --init` (+ LFS) trong worktree nếu task cần `data/` → `hc run --cwd <worktree> ... opencode --prompt ...` → agent làm việc, commit và push trong worktree → merge chỉ qua git-bot (`BRANCHES.md`) → sau khi merge, `git worktree remove` worktree (không xoá nhánh trước khi git-bot merge). Shared root tree chỉ để chat đọc diff / review và các edit một dòng; WIP của phiên khác trong đó không được đụng.
- **Agent xong việc thì KHÔNG bao giờ tự merge nhánh** (Keios, 2026-11-15, thay rule 2026-11-14): agent hc/OpenCode idle → đọc diff / review kết quả → nhánh OK thì đăng ký `Status: ready` trong `.agents/bot/git/BRANCHES.md` (git-bot đọc registry này và merge từng nhánh một) → `hc kill` + `hc rm` và dọn worktree. Không merge tay trong chat; không `-D` nhánh chưa qua git-bot.
- **Luôn spawn agent viết code bằng hc CLI** (Keios, 2026-11-14): mọi việc code (implementer, reviewer, port UI, refactor, fix…) phải chạy trên agent do **`hc run`** tạo — `hc run --bg --outlive-parent --name nsac-<slug> --label project=nsac … opencode --prompt "$(cat /tmp/opencode/<task>.md>"`; đọc `hc --skill` trước khi dùng. Không dùng built-in subagent tool, không tự viết/sửa feature code trong chat — chat chỉ đọc diff / review (không chạy build/test/deploy) và sửa lỗi một dòng (typo, doc, config); deploy do ops chạy qua `OPS.md` sau test pass, một lần một deploy (`scripts/deploy.sh`, không deploy song song). Agent cần build/test để verify → **không tự chạy**: ghi entry `Request: test` vào `.agents/bot/ops/OPS.md` theo mục "Build, test, deploy" ở trên và chờ ops/Keios báo kết quả.
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

- Orchestrator `sky-orchestrator` carries the SOUL identity Sky; specialists such as `sky-generative-ui` (OpenUI spec generator) live alongside. Code: `apps/web/src/features/agent/` (deep module). Adding an agent is a profile file + one registry line + one test row. Server-only PI SDK boundary; no new dependencies. Triple provider: OpenCode Go `opencode-go` is the default (`deepseek-v4.1-flash`); `openrouter` remains as the legacy branch; `amazon-bedrock` added 2026-11-15 (`SKY_AGENT_PROVIDER`, per-profile override via backend `agent.models`). Go key: box env (`SKY_OPENCODE_API_KEY` ?? `OPENCODE_API_KEY`) or `var/sky-opencode.json` (0600, write-only, nhập qua `/admin` → API Keys; env thắng). Bedrock token: env `AWS_BEARER_TOKEN_BEDROCK` hoặc `var/sky-bedrock.json` (0600, cùng contract; region pinned ap-southeast-1).
- **Dual core (2026-11-16):** Pi SDK vẫn là implementation mặc định của code; `agent.core = "mastra"` (admin `/admin/core`, backend `GET|PUT /api/settings/agent-core`) chuyển sang `@mastra/core` qua cùng seam (`SessionFacade` + `runAgent` + `ToolArtifacts`), memory LibSQL ở `var/sky-mastra.db`. **Production chạy Mastra từ 2026-11-17** (Keios set qua `/admin/core` trên box; code fallback khi unset/rác/lỗi vẫn là pi) — Mastra không còn chỉ là "beta tự chọn" trên prod, dù pi giữ nguyên trong repo. Chi tiết HARNESSING §18.
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

#### Hub Gen là console duy nhất (2026-11-17)

- Hub Mock đã bị xóa 2026-11-17 (Keios): `/` là Hub Gen (cây OpenUI) luôn luôn, không còn console switch.

### Repository layout

Thư mục rỗng giữ bằng `.gitkeep`; xóa `.gitkeep` khi thư mục có file thật.

- Nix: `flake.nix` build `apps/web` thành package `.#web` và `apps/backend` thành `.#backend` (backend API, Bun chạy thẳng TypeScript, bind `127.0.0.1` mặc định — `HOST` override; `PORT` mặc định 3200, `SKY_DB_PATH` mặc định `/home/ec2-user/nsac/var/sky.db`). Cả hai dùng chung fixed-output derivation `.#nodeModules` (`nsac-web-node-modules`; `outputHash` phải bump khi `bun.lock` đổi; xem `docs/fod-reproducibility.md`) — FOD này chỉ là build-time input nên deploy pin gcroot riêng `/nix/var/nix/gcroots/nsac-web-node-modules` (out-link `result-node-modules`) để GC không xoá nó. App `nix run .#web` / `nix run .#backend`. Không secrets trong flake.
- `backend/src/nsac/` — Python, không import UI. Phụ thuộc: `api` → `harness`/`agent`/`modules` → `domain` → `contracts`; `adapters` cài đặt interface của `domain`/`modules`.
  - `contracts/` schema Pydantic dùng chung · `domain/{health,crew,outbreak}` entity và luật thuần, không IO · `modules/{cardio,musculoskeletal,space_weather,epidemic,stubs}` module cắm được (`stubs` chỉ interface) · `harness/{triage,dispatch,broadcast,policies}` điều phối deterministic, mỗi luật có `source_url` · `agent/` LangGraph + `rag/` · `reporting/` Jinja2, PDF, outbox · `adapters/{osdr,donki,ollama,sqlite}` · `simulation/` generator và fast-forward · `api/` lớp mỏng cho UI.
- `apps/backend/` Bun + TypeScript API (Drizzle/bun:sqlite, không auth demo; xem `apps/backend/AGENTS.md`): routes `/health`, `/api/astronauts`, `/api/claims`, `/api/agent-traces`, `/api/events` + `/api/cursors`, `/api/sensors/*` + WS `/ws/telemetry`, `/api/settings/agent-model`, `/api/settings/agent-core`, `/api/settings/elevenlabs-key` (write-only), `/api/settings/speech-engine*` (admin surface, loopback-only), `/api/tts`, speech surface cho voice chat (`/api/speech/register` + `/api/speech/config` + `/api/speech/token` + Speech Engine WS `127.0.0.1:SPEECH_WS_PORT` mặc định 3300, hand-rolled `Bun.serve`, JWT luôn bật; `/api/speech/token` mint conversation token server-side bằng key ElevenLabs của `/admin`, engine tạo với `auth.enable_auth: true`; deployed 2026-11-16 (`deploy-2026-11-16`, box = 4785c81); Caddy route `/speech/ws` → `127.0.0.1:3300` live (xem repo `opfa-aws-manage`); WS chỉ listen khi có env `ELEVENLABS_SPEECH_ENGINE_ID` — engine tạo qua `scripts/speech-engine.ts` (key cần `convai_read/write`; key `/admin` chỉ có TTS nên chưa tạo được engine — xem notes), key JWT verify fallback = key trong DB `/admin`), và health observation layer `/api/health/performance/:astronautId` + `/api/health/observations` (11 metric fitness/smartwatch synthetic — energy, muscle, sleep, hydration — seed idempotent 35 ngày, `energy_balance` derived; mọi row có `method`/`quality`/`source`, tuning + URL nguồn ở `src/health/metrics.ts`, không ngưỡng lâm sàng).
- `apps/ml-inference/` FastAPI + uv (Python 3.12) phục vụ 26 mô hình đã train của `data/3_models` (joblib) trên `127.0.0.1:8100`; **chưa** được backend gọi (vòng sau), không có agent bác sĩ. Registry đọc `data/configs/tasks.yaml`, pin run mới nhất + `deploy_model` (không phải best model), nạp qua `sky_ml._artifacts.load_model` (kiểm SHA-256 theo manifest), `interval90` = split-conformal từ `oof.csv.gz` (`sky_ml/5_predict.py`), abstain `missing_features`/`out_of_training_range`/`insufficient_calibration_data`/`history_required`. Route `/health`, `/v1/models`, `/v1/models/{task}`, `/v1/predict`, `/v1/predict/batch` (cap 64). `sky_ml` nạp qua `sys.path` (`SKY_ML_SRC`), không phải dependency uv (tránh kéo mne/shap/matplotlib của bộ train). Nix `.#inference` (+ FOD wheelhouse `.#inferenceWheels`, hash theo platform) → `result-inference` + gcroot `nsac-inference` + unit `ops/nsac-inference.service` qua stage inference fail-soft của `scripts/deploy.sh`; chi tiết `apps/ml-inference/AGENTS.md`.
- `ops/nsac-marimo.service` (cùng kiểu inference; packaging = **FOD wheelhouse per-system hash** — chọn theo đề xuất của CEO 2026-11-17, sign-off cuối cùng thuộc về Keios lúc merge/deploy): `.#marimoWheels` (FOD, `ops/marimo-requirements.txt` pin + hash toàn bộ 36 package qua `uv pip compile --python-version 3.12 --generate-hashes`, `pip download --no-deps --only-binary=:all: --require-hashes`, `--platform`/`--abi` pin cứng, `outputHash` per-system: x86_64 `sha256-ltrRvf5vMrbDib2ac2UqON5wTkM3ou5Xe1efAI6YX2c=`, aarch64 `sha256-e2W1KJ33MNxmq4T+g/BcaFs7Q9zaA9AWTh7RTjvR2c8=`) → `.#marimo` venv (uv, `--no-index --find-links`), `marimo run notebooks` **read-only folder mode** của `data/notebooks` trên `127.0.0.1:8200`, `--base-url /notebooks`, phục vụ sau Caddy cùng origin tại `/notebooks*` (Caddy handle do infra Keios thêm riêng; web iframe route đã bị bỏ — marimo serve thẳng). Phục vụ từ checkout rsync trên box (`/home/ec2-user/nsac/data`, LFS đã smudge) — KHÔNG từ flake input nsac-data (thiếu LFS). `result-marimo` out-link + gcroot `nsac-marimo` (enforce bởi `scripts/nix-gc.sh` từ commit packaging; `.#marimo` giữ reference tới FOD qua `share/marimo-wheels`); stage marimo trong `scripts/deploy.sh` fail-soft như inference cho box/ssh/build/unit lỗi, nhưng unit chạy mà `/notebooks/` ≠ 200 ⇒ exit 1, không tag.
- `apps/onboard/` NiceGUI theo `features/<name>/` + `shared/` · `apps/website/` website tĩnh (chỗ giữ, chưa dùng) · `apps/web/` web app Sky (TanStack Start, xem `apps/web/AGENTS.md`): routes `/` (SKY HUD + chat AI Elements floating card qua portal trên console), `/data` (bản đồ nsac-data — server route trả thẳng `data/DATA.html` từ submodule, không chrome), `/performance` (SKY / Human Performance — 12 ô chỉ số mô phỏng + Sky insight tất định + dải LIVE vitals poll 5 s từ `/api/health/live/:id` qua proxy `routes/api/health.live.$astronautId.ts`, ba nhãn LIVE/HISTORICAL/OFFLINE), `/health` (agent config readiness, no secrets), `/admin` (ẩn, không link, noindex, cần `SKY_ADMIN_KEY`, bảy tab `/admin/{models,keys,speech,claims,background,core,schedules}` — đổi model agent qua backend `/api/settings/agent-model`, API Keys panel (OpenCode Go + AWS Bedrock + ElevenLabs, write-only, `var/sky-*.json` file store hoặc env), nút reset toàn bộ claims qua `POST /api/claims/reset`, Speech Engine panel (trạng thái/probe/create/stop/start/delete engine ElevenLabs), `/admin/background` chọn backdrop `/` (Particles mặc định | Galaxy; admin luôn thắng — `?bg=`/`nsac.bg` đã bị gỡ), `/admin/core` chọn core agent (Pi SDK code-default | Mastra — production đang chạy Mastra), `/admin/schedules` quản lý Mastra Schedules threaded vào astronaut chat thread (HARNESSING §19)) và `/spacecraft` (NASA ISS cinematic viewer, lazy three.js, draco decoder vendored từ three vào `public/draco/`); includes `features/body-map/` Open Anatomy 3D hologram body map (`/body` fullscreen page: rail + attribution + Esc kbd chip + accessible Body Tree + non-drag view controls; HUD overlay variant unchanged; lazy three.js, CC BY 4.0 attribution) and `features/spacecraft/` (`/spacecraft` — NASA ISS cinematic viewer); the health card of the `/` console (body tab) shows a minimal 3D body (`features/sky-hud/components/HologramBody.tsx`, skin + skeleton asset `public/models/anatomy-male-holo.glb` sinh bằng `scripts/holo-model.ts`, pubis đã flatten ở mức asset); vendored third-party UI in `src/shared/react-bits/` (React Bits, MIT + Commons Clause, not OSI-approved, vendored on Keios's explicit instruction 2026-11-14, LICENSE.md kept beside the code) and `src/shared/ai-elements/` (shadcn AI Elements chat parts, MIT, adapted).
- Workspace JS ở root: `package.json` (bun, `workspaces: ["apps/*"]`), `turbo.json` (Turborepo: `dev`, `build`, `typecheck`, `test`), `tsconfig.base.json`. Mỗi app JS là một package `@nsac/<tên>` trong `apps/`; app Python (`onboard`) và `practice/` (workspace riêng) nằm ngoài. Cài và chạy từ root: `bun install`, `bun run typecheck|test|build`.
- `data/` git submodule → `https://github.com/wosonday/nsac-data.git` (nhánh `main`): dữ liệu/features/models/predictions demo (pin `c76d50d`, đã có `DATA.html`). Clone lần đầu: `git submodule update --init`. Không sửa nội dung submodule từ repo này — sửa trên repo nsac-data rồi bump pointer ở đây.

- `PRODUCT.md` bản chốt ngữ cảnh sản phẩm cho Impeccable (audience, positioning, constraints, evidence): web app cho demo NASA Space Apps 2026; không phải dashboard, không phải bác sĩ; AI không quyết một mình; nguồn trích dẫn mọi nơi. Không viết lại khi design đổi — cập nhật khi product intent đổi.
- `DESIGN.md` hệ thống visual hiện hành (nguồn sự thật về thiết kế, sinh từ code đang ship): YAML frontmatter token (`colors`, `typography`, `rounded`, `spacing`, `components`) + 8 mục chuẩn (Overview "The Quiet Instrument" · Colors · Typography · Layout · Elevation & Depth · Shapes · Components · Do's and Don'ts); token thật nằm ở `apps/web/src/styles/global.css` và các lớp Tailwind trong `features/*/*-classes.ts`. Sidecar máy đọc `.impeccable/design.json` (ramp màu, motion, breakpoints, snippet component) sinh cùng lúc — sửa `DESIGN.md` thì sinh lại sidecar (`/impeccable document`). Cập nhật khi token/component đổi. `DESIGN-proposal-v1.md` là bản đề xuất v1.0.0 đã bị thay thế, giữ lại cho phần không thuộc visual system (Canopy/Aperture/Horizon/Tether, bảng thẩm quyền A0–A4, operational modes, 14 experience state, state machine, acceptance/test matrix); khi xung đột thì `DESIGN.md` thắng.
- `STORY.md` truyện hư cấu "Sky" (thiên thần theo phi hành gia, dịch từ khu vườn trên tàu) cho phần kể chuyện/demo; bảng cuối map truyện sang module, cập nhật khi module đổi.
- `UX.md` bản đặc tả UX/UI của Sky (SKY — Living Symbiotic Healthcare Interface): vision, ngôn ngữ visual, không phải code; token và quy tắc visual hiện hành nằm ở `DESIGN.md` (file này giữ phần ý tưởng); cập nhật khi hướng thiết kế đổi.
- `UX_IMPLEMENTATION.md` ma trận traceability UX.md → code, trạng thái và hạn chế; cập nhật khi cover tăng.
- `SKY_UI_COMPONENT_FUNCTIONAL_SPEC.md` spec pixel-matched màn hình HUD astronaut wellness (12 components, state machine voice, design tokens); `/` là màn hình này, `/console` giữ bản console cũ.
- `ARCHITECTURE.md` mô tả cấu trúc code đang có: bản đồ repo, luồng dữ liệu backend, layer và chiều phụ thuộc, layout/SSR/server boundary của `apps/web`, nguồn dữ liệu, cách chạy và khoảng trống. Cập nhật khi cấu trúc hay ranh giới layer đổi.
- `HARNESSING.md` cách các agent Pi SDK (`features/agent`) chạy và phối hợp: profile/registry, boundary `pi.server.ts`, per-astronaut sessions, dispatch deterministic không LLM routing, tools/skills hiện tắt cố ý, output gates, failure modes, env. Cập nhật khi harness hoặc cách phối hợp đổi.
- `SENSOR_SIMULATION_SPEC.md` contract thiết bị/cảm biến + dữ liệu Sky (registry 38 thiết bị, phân biệt real/research/development, 12 stream simulated, telemetry envelope, scenarios, fault injection, REST + WS `/ws/telemetry`, SQLite `telemetry_events`). Backend implement ở `apps/backend/src/sensors/`. Bám HKT rules (synthetic data, AI không quyết định, ngưỡng kèm URL). Cập nhật khi registry/schema/API đổi.
- `assets/models3d/` (mỗi model kèm license/nguồn) · `assets/fixtures/` · `scripts/` · `tests/` (phản chiếu `backend/`) · `var/` (gitignored, trạng thái runtime).
- `video/` — nguồn HTML (HyperFrames) của launch film 30s 16:9 về web app production (nasa.taquangkhoi.com). Hiện tại là **v3** (`index-v3.html`, product-launch script: Intro → 01 Continuous Monitoring → 02 Clinical Assistance → 03 Connected Medical Support → Closing, không voiceover (rule cố định) — chỉ music bed + SFX, xem `video/SPEC.md`); v1 ("Sky — Never Alone in Space") lưu ở `index-v1.html` + `SPEC-v1.md`/`REVIEW-v1.md`. Render MP4 không commit (bản v3: `out/sky-launch-30s-v3.mp4`); `media/` chứa plate chụp app (+ ảnh NASA PD cho v1), VO và audio ElevenLabs (nguồn/điều khoản: `video/media/CREDITS.md`).
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
| `docs/design/watchos-26/AGENTS.md` | watchOS 26 (Apple Design Resources) — factual design reference for `/watch` (tokens, Dynamic Type, dimensions, component inventory; no Apple artwork/fonts) |
| `practice/AGENTS.md` | Monorepo luyện tay (bun + Turborepo: TanStack Start, Mastra, OpenUI, mô phỏng cúm); không thuộc bài nộp HKT, không chuyển vào thư mục dự án trước 14/11/2026 09:00 |
| `apps/backend/AGENTS.md` | Bun + TypeScript API Sky: DB ownership theo connection (`client`/`claims`/`events`/`sensors`/`settings`), route list + lỗi JSON (gồm `/api/tts` + `/api/settings/elevenlabs-key`, ElevenLabs key write-only, sky TTS; `/api/settings/agent-core` (`pi` default | `mastra`, dual-core HARNESSING §18, cùng contract); `/api/settings/speech-engine*` (admin surface, loopback-only; engine id env > DB, stop/start lifecycle)), `/api/settings/agent-models` (provider + per-profile model override; providers `opencode-go|openrouter|amazon-bedrock`), health observation layer (11 metric synthetic, seed idempotent 35 ngày, `method`/`quality`, tuning + URL nguồn, không ngưỡng lâm sàng), Speech Engine (`/api/speech/register|config|token` + WS `SPEECH_WS_PORT` 3300 hand-rolled, JWT luôn bật; token mint server-side, engine create gửi `auth.enable_auth: true`; deployed 2026-11-16 `deploy-2026-11-16`; Caddy route `/speech/ws` live; WS listen khi có `ELEVENLABS_SPEECH_ENGINE_ID` — tạo engine bằng `scripts/speech-engine.ts` (cần key có `convai_read/write`)) |
| `apps/web/AGENTS.md` | Web app Sky (TanStack Start, bun, Turborepo): routes `/` (`features/hud-gen/` — Hub Gen, console duy nhất: 3 cột profile/vitals/trends · orb+voice · readiness tabs+mini cards dựng bằng OpenUI Lang trên catalog (`components/*` + `data/*`, fixture SIMULATED), voice mic-analyser qua ElevenLabs Speech Engine (`useVoiceChat`), React Bits Crystalized Ball orb, astronaut picker claim-locked qua backend `/api/claims` (auto-release sau 30 phút idle; + force-release có epoch kick qua `/api/claims/reset`), session ẩn danh `nsac.session`, avatar portrait `public/astronauts/<id>.png` (shared `AstronautAvatar`, initials fallback) ở picker/presence `/spacecraft`/header `/performance`/3D markers; device switcher (Console|Watch); chat "Type instead" = shadcn AI Elements floating card vendored ở `src/shared/ai-elements/` + `useChat` (`@ai-sdk/react`) qua custom `ChatTransport` POST tới server route SSE `/api/chat-stream` (delta token-by-token qua codec `runtime/sse.ts`, `sendChatTurn`/`sendChat` giữ cho `/watch`; turn còn có thể phát một frame `{"type":"ui","program":…}` từ tool `show_on_hud` — Sky đổi cây HUD gen, chip "Back to Sky's view" để trả lại), không đổi backend; `/watch` giữ `ChatPanel` cũ), `/watch` (smartwatch mockup frame — live WatchHud clipped in the glass face, mọi viewport kể cả ≤480px; chip navigate giữa `/` và `/watch`), `/data` (bản đồ nsac-data — server route trả nguyên `data/DATA.html` từ submodule, không chrome), `/body` (Open Anatomy 3D body map, three.js chỉ tải ở route này, CC BY 4.0, hover/tap cấu trúc → tooltip catalog facts tại con trỏ), `/performance` (SKY / Human Performance — 12 ô chỉ số mô phỏng theo thứ tự BGK + Sky insight tất định một dòng kèm nguồn NASA, backend `/api/health/performance/:id`, fallback fixture + footnote "backend unavailable" khi backend không phản hồi; dải LIVE vitals poll 5 s từ `/api/health/live/:id` qua proxy `routes/api/health.live.$astronautId.ts`, nhãn LIVE/HISTORICAL/OFFLINE, `/` vitals bind cùng feed LIVE/HISTORICAL/OFFLINE (6 dòng, HRV)), `/health` (agent readiness + roster, không tiết lộ secret), `/admin` (ẩn, noindex, `SKY_ADMIN_KEY`, redirect → `/admin/models`; bảy tab có route riêng `/admin/models` (mặc định) / `/admin/keys` / `/admin/speech` / `/admin/claims` / `/admin/background` / `/admin/core` / `/admin/schedules` để deep-link (`/admin/opencode` + `/admin/elevenlabs` là 307 redirect → `/admin/keys`), tab bar beui morphing-tabs điều khiển theo route; đổi provider + model agent (per-profile override) qua backend `/api/settings/agent-models`, nút reset claims demo qua `POST /api/claims/reset`, API Keys tab — OpenCode Go + AWS Bedrock + ElevenLabs (write-only; Bedrock mới 2026-11-16: env `AWS_BEARER_TOKEN_BEDROCK` thắng, fallback `var/sky-bedrock.json` 0600 qua `/admin`; region pinned ap-southeast-1), Speech Engine panel (trạng thái/probe/create/stop/start/delete engine ElevenLabs), `/admin/background` chọn backdrop của `/` (React Bits Particles mặc định | Galaxy; backend key `hud.background`; admin luôn thắng — `?bg=`/`nsac.bg` đã bị gỡ) và `/admin/core` chọn core agent (Pi SDK mặc định | Mastra beta; backend key `agent.core`, `var/sky-mastra.db`; chi tiết HARNESSING §18)) và `/spacecraft` (NASA ISS cinematic viewer — streaming full-detail mặc định (ISS-B overview → streamed parts → crossfade; `?stream=0` one-shot), không UI chrome ngoại trừ crew presence avatar group bottom-left (beui-adapted, MIT — `src/shared/beui/`) + simulated 3D crew position markers (`model/crew-positions.ts`, `POSITIONS SIMULATED` caption), lazy three.js, draco decoder local, camera fit theo projected box); Sky dựng panel OpenUI qua agent core trên production = Mastra (2026-11-17 qua `/admin/core`; code default vẫn pi) — Sky dựng panel OpenUI qua `sky-orchestrator` + `sky-generative-ui`; triple provider — OpenCode Go mặc định (`deepseek-v4.1-flash`), OpenRouter legacy qua `SKY_AGENT_PROVIDER=openrouter`, AWS Bedrock qua `SKY_AGENT_PROVIDER=amazon-bedrock`); không có key/mạng thì agent trả preset; React Bits vendored trong `src/shared/react-bits/` (61 components, MIT + Commons Clause, attribution, xem THIRD_PARTY_NOTICES.md; mic console `/` = VoicePill khi idle + voice chat qua ElevenLabs Speech Engine (fallback hint khi chưa cấu hình; `useVoiceChat`; `useSkyVoice` chỉ còn ở `/watch`), ListeningBar khi nghe, chat mở bằng ⌘K/Ctrl+K); Open Anatomy model trong `public/models/` (CC BY 4.0); onedollarstats (MIT) analytics — hosted collector, pageviews+clicks, `/admin` excluded; song ngữ en/vi (per apps/web/AGENTS.md, gồm `hudMock.voice*`); `/research` — read-only NASA analog cohort evidence (`features/research/`, committed static bundle từ `data/` submodule, analog research không gán cho crew hư cấu); `/notebooks` — Sky chrome + full-viewport iframe cùng origin `/marimo/` (marimo service 127.0.0.1:8200, read-only, noindex; Caddy same-origin path) |
| `apps/ml-inference/AGENTS.md` | FastAPI + uv (Python 3.12) phục vụ 26 mô hình `data/3_models` trên `127.0.0.1:8100`: SKY_DATA_ROOT/SKY_ML_SRC contract, registry pin run + `deploy_model`, SHA-256 qua `sky_ml._artifacts.load_model`, interval90 split-conformal từ OOF (`sky_ml/5_predict.py`), abstain contract (`missing_features`/`out_of_training_range`/`insufficient_calibration_data`/`history_required`), `history` cho personal_mean/mean_delta, feature builder v1 = identity, route v1 + mã lỗi (404 unknown_task, 422 unknown_feature, 503 task_unavailable, batch cap 64), nix `.#inference`/`.#inferenceWheels` (FOD wheelhouse, outputHash per-system + lý do FOD không thể chứa venv), gcroot `nsac-inference`, unit `ops/nsac-inference.service`, stage inference fail-soft trong `scripts/deploy.sh` |
| `video/AGENTS.md` | Sky launch film 30s (HyperFrames HTML/CSS, 16:9 1920×1080). v3 hiện hành: product-launch script (Intro → Monitoring → Clinical → Surgeon → Closing) + music/SFX, không VO (`index-v3.html`); v1 archived (`index-v1.html`); `media/` = product plates (+ NASA PD v1) + generated audio; render MP4/caches không commit |
| `apps/web/src/features/iss/` | ISS spatial streaming cho `/spacecraft`: ISS-B overview → manifest → part stream theo camera relevance (LRU 6 GPU cache) → crossfade; streamed assets (Git LFS) sinh bởi `scripts/iss/split-iss.ts` |

Not indexed (not durable boundaries): `.agents/` (bot làm việc local — `.agents/bot/ceo/` CEO bot theo dõi agent hc; `.agents/bot/git/` git-bot: hợp đồng trong `AGENTS.md` + registry `BRANCHES.md` (git-ignored, local coordination — merge gate, nhánh chỉ được git-bot merge, chat/CEO không tự merge), tracked; `.agents/bot/ops/` ops-bot: hợp đồng trong `AGENTS.md` + queue `OPS.md` (git-ignored, local coordination — build/test/deploy theo yêu cầu, một job một lúc), tracked; `HC-AGENTS.md` git-ignored), `.kiro/`, `.local/`.

Root `README.md` vẫn là điểm vào sản phẩm và tech stack; thêm child khi một thư mục có boundary riêng (catalog, API client, contest entry).
