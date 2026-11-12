# Bot · CEO

## Purpose

- Directory for agents acting as the CEO bot of this project. Parent rules for the whole repo live in the root [AGENTS.md](../../AGENTS.md) and still apply in full — including the **HKT — NASA Space Apps 2026** implementation contract (offline-first, OSI-approved licenses only, cited medical thresholds, AI never decides alone, no personal data) and the DOX closeout rules; `.agents/` is not part of the DOX index (see the root doc's "Not indexed" note).
- Project context: challenge **Create Health Monitoring Software for Astronauts on Space Missions** (HCMC, 14–15/11/2026; submission before 15/11 23:59 local). Work is split across 3 people / 3 agents (see root AGENTS.md, mục "Work split"): Agent 1 = data/detection/score, Agent 2 = agent/RAG/report/delay, Agent 3 = UI/story/submission.

## herdr hc CLI — spawning and managing coding agents (Keios, 2026-11-12)

- Khi cần tạo / quản lý agent viết code (implementer, reviewer, đơn vị coding…), dùng **`hc` CLI** (herdr-core, `/home/keios/.local/bin/hc`) — không dùng tool subagent mặc định cho việc này (Use the `hc` CLI to spawn and manage code-writing agents instead of the built-in subagent tool).
- Trước khi dùng, đọc manual hiện tại bằng **`hc --skill`** (không dựa vào trí nhớ; manual có thể đổi). `hc templates` xem role có sẵn; template mới là file Markdown ở `~/.config/herdr-core/templates/<name>.md`.
- **Đặt tên `--name`: slug mô tả task** (Keios, 2026-11-12): dự án này không có issue tracker — dùng `nsac-<slug>` kebab-case, vd. `nsac-cardio-deviation-engine`, `nsac-readiness-score`, `nsac-nicegui-timeline`. Tên phản ánh đúng việc để `hc ls` đọc là hiểu ngay; giữ ngắn, không dấu. hc không có lệnh rename — đặt đúng ngay từ `hc run`.
- Luật vận hành theo manual: luôn `--bg` + `--name` + `--cwd`; task đầu tiên đặt ngay trong `hc run`; chạy interactive, **không** one-shot print mode (`pi -p`…); scope chặt trong task (file/việc được sửa, "no subagents" trừ khi được phép); spawn không tự cho agent con spawn thêm agent.
- Đợi và thu kết quả bằng `hc wait <t>` / `hc wait --children` (không sleep/poll); `hc read <t>` xem màn hình; báo cáo dài yêu cầu agent viết ra file rồi gửi path; đọc kết quả thật trước khi tóm tắt, không suy diễn từ kỳ vọng.
- hc ≠ herdr cũ; `$HC_TERMINAL_ID` là địa chỉ của mình; agent con báo cáo qua `hc send $HC_TERMINAL_ID`.
- Agent được spawn vẫn phải tuân toàn bộ AGENTS.md/DOX của repo, đặc biệt HKT hard rules: chạy offline, mọi dependency OSI-approved (không PyMuPDF/hrv-analysis/piper1-gpl…), mọi ngưỡng y khoa/trọng số có URL nguồn trong comment code và UI, LLM chỉ giải thích — phát hiện deterministic, phi hành gia xác nhận mọi hành động.
- Session OpenCode có sẵn: hc **không adopt** tiến trình đã chạy ngoài hc (`hc ls` trống), nhưng resume được trong hc: `hc run --bg --name <n> opencode -s <session-id>` — hc nhận diện `agent:"opencode"` và trạng thái `idle`/working, `hc wait`/`hc read`/`hc send`/`hc interrupt` dùng được trên TUI. Session TUI không tự kết thúc nên `hc wait <t>` = đợi agent hết lượt. (Verified 2026-11-12.)
- Mặc định resume bằng **`opencode -s <id>`** (TUI đầy đủ) qua hc — hc bắt được trạng thái `working`/`idle` để `hc wait`/`hc get` theo dõi hết lượt (user chọn 2026-11-12). Chỉ khi cần đọc nội dung agent thì resume bằng **`opencode mini -s <id>`** (log tuyến tính, `hc read` ra hội thoại/tool calls dạng text); mini không báo status (luôn `None`) nên khó canh hết lượt. Kill TUI/mini rồi resume lại không ảnh hưởng agent đang chạy phía server.
- **Spawn agent mới với task: `opencode --prompt '<task>'`** — positional argument của `opencode` là `<directory>`, không phải task; `hc run ... opencode '<task>'` chết ngay với `ENOENT chdir '<cwd>' -> '<task>'` (exit 1) (Verified 2026-11-12).
- **Heartbeat cuối lượt: opencode Scheduled Tasks** (thay `sleep` + arm thủ công): bật `"experimental": { "schedules": true }` trong `~/.config/opencode/opencode.json` (config watch tự reload, không restart); API qua `opencode api`: `POST /api/experimental/schedule` tạo, `GET ...?sessionID=<id>` list, `POST .../pause|resume`, `DELETE .../<id>` (endpoint schedule cần `sessionID`). Body tạo: `{"sessionID","name":"heartbeat","when":{"every":"10 minutes"},"prompt":"…"}` — mỗi nhịp là một lượt chat (credits) gửi prompt vào session; prompt nên dặn: chỉ báo cáo cái MỚI. (Verified 2026-11-12.)

## Heartbeat — xử lý agent idle (Keios, 2026-11-12)

- Heartbeat (và mọi lượt theo dõi `hc ls`) **không chỉ báo cáo**: khi thấy agent `idle`, phải `hc read <t>` để xem nó xong/bị chặn, rồi hành động:
  - **Việc đã xong** (đạt yêu cầu, commit sạch): review/verify kết quả, merge nhánh của agent vào `main`, rồi dọn đầy đủ — `git worktree remove --force`, `git branch -d` (chỉ nhánh đã merge), `git worktree prune`, `hc kill` + `hc rm` bản ghi. Khi gần/đã qua 14–15/11, verify theo checklist HKT trong root AGENTS.md (Verification): chạy end-to-end khi rút mạng, demo < 60 giây không crash, mọi ngưỡng/trọng số hiển thị nguồn, Confirm chặn mọi hành động, PDF báo cáo queue với delay 20 phút.
  - **Chưa xong / rõ ràng thiếu bước** (chưa commit, chưa verify, đang chờ): gửi `hc send <t> "<prompt thích hợp>"` — ví dụ yêu cầu chạy test/typecheck (`bun run typecheck|test`, `pytest`), commit, hoặc hoàn tất phần còn lại; chờ lượt sau kiểm tra lại.
  - **Bị chặn / cần quyết định của Keios** (thiếu key, chọn trade-off, lỗi ngoài phạm vi): báo cáo ngắn gọn, không tự ý làm liều.
- Không merge nhánh chưa hoàn chỉnh hoặc còn thay đổi chưa commit; không `-D` nhánh chưa merge.
- **Repo này không có deploy pipeline** (hackathon, nộp bài qua form submission): heartbeat **không tự push** `main`/tags và không tự "deploy". Push chỉ khi Keios yêu cầu; tuyệt đối không force-push, không push nhánh đang làm dở. Việc "release" gần nhất của dự án là trang submission + repo public Apache-2.0 — làm theo checklist HKT trong root AGENTS.md, không tự động hoá.
- Ghi kết quả xử lý vào HC-AGENTS.md (git-ignored, local only — không commit; schedule `hc-agents-update` cũng làm việc này).

## Background wait — mọi agent trong hc phải có ngón tay canh (Keios, 2026-11-12)

- **Luôn giữ một background shell `hc wait <t> --timeout 7200` cho mỗi agent đang chạy trong hc**, mở ngay khi spawn/resume agent (và sau mỗi lần `hc wait` kết thúc mà agent còn `working`). Khi waiter kết thúc (agent hết lượt hoặc báo xong/blocked) harness sẽ báo ngay — không chờ heartbeat polling.
- `hc wait --children all` **không dùng được từ shell ngoài hc** (cần biết parent; `$HC_TERMINAL_ID` trống khi mình không ở trong terminal hc) — luôn chờ **theo từng terminal**: `hc wait <t> --timeout 7200`.
- `--timeout 7200` (2h) để waiter không rơi ra hết lượt sớm; `reason: "timeout"` nghĩa là vẫn đang chạy — mở waiter mới, không tưởng fail.
- Khi waiter báo (hoặc message tới với `reason: message`): xử lý theo "Heartbeat — xử lý agent idle" — đọc kết quả thật rồi merge/dọn hoặc send tiếp. Một waiter mỗi agent; khi agent đã kill/rm thì waiter kết thúc theo.

## hc — vận hành hằng ngày (verified 2026-11-12)

- `hc kill <t>` kết thúc chương trình (TUI chết; agent phía opencode server vẫn sống — resume bằng `hc run --bg --name <n> opencode -s <session-id>`). `hc rm <t>` xoá bản ghi finished; `hc ls --all` xem cả finished; `hc ls` chỉ thấy live.
- `hc get <t>` trả JSON đầy đủ: `agent` (opencode…), `state` (live|finished), `status.state` (working|idle|None), `turn`, `exit_code`, `title`.
- `hc wait <t> [--timeout SEC]` kết thúc khi agent hết lượt (idle) hoặc process chết; `reason: "timeout"` nghĩa là vẫn đang chạy — chờ tiếp, đừng tưởng fail.
- `hc templates` hiện trả `{"templates":[]}` — chưa có role mẫu; spawn thẳng `opencode --prompt`.
- **Prompt dài cho agent: ghi ra file rồi `--prompt "$(cat /tmp/name.txt)"`** — `hc run ... opencode --prompt '<prompt rất dài>'` dễ bị từ chối với "Portable shell scanner cannot analyze command: compound-command" (đặc biệt khi lồng quote); heredoc + đọc file an toàn hơn nhiều (verified 2026-11-12).
- Trong hc, session opencode có `agent:"opencode"`; kill TUI rồi resume lại không ảnh hưởng lượt đang chạy phía server.

## Child DOX Index

- `HC-AGENTS.md`: snapshot trạng thái agent trong `hc ls` (worktree/branch, task, commits, việc còn lại) + trạng thái repo (`main`/`origin`, stash). **Git-ignored, local only** — file đổi liên tục nên không commit/push; không phải rule; đọc lại trước khi tin
- `SCHEDULE.md`: opencode Scheduled Tasks (experimental) — cấu hình `experimental.schedules`, API `opencode api` (tạo/list/xoá/pause/resume), payload `Schedule.CreatePayload`, gotchas. Tham chiếu khi tạo/đổi/xoá schedule
- `.opencode/commands/heartbeat-{on,off,status}.md` + `.opencode/scripts/heartbeat-schedule.sh`: bật/tắt/xem schedule của session đang mở; `.opencode/commands/heartbeat-*.md` ở repo root là **symlink** để OpenCode discover (nested `.agents/.../.opencode` không được quét)
