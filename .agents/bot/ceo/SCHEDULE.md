# SCHEDULE — opencode Scheduled Tasks (experimental)

- Feature: `experimental.schedules` trong `~/.config/opencode/opencode.json`:
  ```jsonc
  {
    "$schema": "https://app.kilo.ai/config.json",
    "model": "opencode/inkling-2-small-free",
    "experimental": { "schedules": true }
  }
  ```
  Config được watch tự reload — không restart server. Đánh dấu **experimental**: có thể đổi/gãy bất kỳ release nào.

## Điều khiển qua `opencode api`

- Tạo: `POST /api/experimental/schedule`
- List: `GET /api/experimental/schedule?sessionID=<id>` (**sessionID bắt buộc**; session nào hỏi thì thấy schedule của session đó)
- Get: `GET /api/experimental/schedule/<id>`
- Xoá: `DELETE /api/experimental/schedule/<id>`
- Tạm dừng / bật lại: `POST /api/experimental/schedule/<id>/pause|resume`

## Request tạo (`Schedule.CreatePayload`)

```json
{
  "sessionID": "ses_...",
  "name": "heartbeat",
  "when": { "every": "5 minutes" },   // hoặc { "cron": "*/5 * * * *", "tz": "Asia/Ho_Chi_Minh" } | { "at": "2026-11-12T21:00:00+07:00" } | { "in": "10 minutes" }
  "if":   { "run": "hc ls" },          // tuỳ chọn: chỉ thức khi lệnh shell exit 0 (stdout được nối vào prompt)
  "until":{ "run": "..." },            // tuỳ chọn: dừng hẳn khi điều kiện đúng (khác "if")
  "ends": { "times": 12 },             // hoặc { "after": "2 hours" } | { "at": "2026-11-13T00:00:00+07:00" }
  "prompt": "..."                      // bắt buộc; mỗi nhịp là 1 user message gửi vào session (1 lượt = credits)
}
```

- `when`: `{ every: "5 minutes" }` | `{ cron, tz? }` | `{ at, tz? }` | `{ in, tz? }` (Duration: "90 seconds", "5 minutes", "2 hours").
- `if` / `until` nhận `{ run, is?, matches?, changes? }` hoặc `{ code }` (Code Mode JS check, không fetch, 30s, 20 tools, 32 KB output; `state`, `now`, `runs`; trả boolean hoặc `{ wake, state?, message? }`).
- Status: `active` | `paused` | `done`. Mỗi nhịp ghi `runCount`, `lastOutcome` (`fired|late|checked|expired|skipped|disabled|failed`), `nextDueAt`, `endsAt`, `remainingRuns`.
- Scheduled task gắn với **một session** (`sessionID`); prompt bắn vào đúng session đó.

## Heartbeat hiện tại

**Chưa có schedule nào được tạo cho dự án này** (khởi tạo 2026-11-12). Khi cần, tạo trên session đang mở bằng payload ở trên, gợi ý:

- `heartbeat` — every 10 phút, tz `Asia/Ho_Chi_Minh`. Prompt nên gói đúng luật trong AGENTS.md mục "Heartbeat — xử lý agent idle": xem `hc ls`; agent `idle` → `hc read` rồi merge+dọn (nhánh xong, verify, không push) hoặc `hc send` tiếp; bị chặn → báo Keios; chỉ báo cáo cái MỚI. Dự án không có deploy pipeline — heartbeat không tự push.
- `hc-agents-update` — every 30 phút, tz `Asia/Ho_Chi_Minh`. Prompt: tự cập nhật `.agents/bot/ceo/HC-AGENTS.md` theo thực tế (`hc ls` / `hc ls --all` + `git log`), chỉ sửa phần trạng thái; file đã **git-ignored** nên KHÔNG commit/push; không merge/push/dọn worktree.

- Mỗi nhịp = 1 lượt chat/credits; heartbeat 10 phút là nhịp dự phòng — việc canh agent do background `hc wait` đảm nhiệm (xem AGENTS.md).
- Không có endpoint PATCH: muốn đổi prompt/when thì xoá + tạo lại.

## Bật / tắt nhanh (OpenCode commands)

- `/heartbeat-off [tên...]` — pause (mặc định `heartbeat`; thêm `hc-agents-update` nếu muốn tắt cả hai).
- `/heartbeat-on [tên...]` — resume schedule đã pause.
- `/heartbeat-status` — bảng id / status / runs / next due của session hiện tại.
- Command file sống ở `.agents/bot/ceo/.opencode/commands/`, script ở `.agents/bot/ceo/.opencode/scripts/heartbeat-schedule.sh`; `.opencode/commands/heartbeat-*.md` ở repo root là **symlink** để OpenCode discover (nested `.agents/.../.opencode` không được quét).
- Command chỉ là prompt: agent chạy script bằng shell tool (shell block của command không có `$OPENCODE_SESSION_ID`), script dùng `$OPENCODE_SESSION_ID` + `opencode api`, nên chỉ áp dụng cho schedule của **session đang mở**. Mỗi lần bật/tắt tốn 1 lượt chat. Tạo lại schedule đã xoá vẫn phải làm tay theo payload ở trên.

## Ghi chú / gotchas

- `opencode api` (không có flag) tự dùng background service của opencode và tự lo discovery/auth.
- Không có endpoint PATCH để sửa prompt/when/...: muốn đổi thì **xoá + tạo lại**.
- `experimental` → có thể biến mất hoặc đổi shape bất cứ bản nào; khi lên bản mới nhớ kiểm tra lại `GET /api/experimental/schedule?sessionID=...` và openapi (`opencode api get /openapi.json > /tmp/x && grep -i schedule /tmp/x`).
