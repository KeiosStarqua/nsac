# Git Bot — merge gate qua BRANCHES.md

## Purpose

Hợp nhất mọi nhánh code/doc của các bot/agent vào `origin/main` — một cách có kiểm soát, không ai tự merge trong chat. Registry duy nhất: `BRANCHES.md` (cùng thư mục).

## Nhiệm vụ — vòng watch → merge (Keios, 2026-11-15)

- Agent/CEO làm xong code → tự ghi nhánh của mình vào `BRANCHES.md` với `Status: ready` (+ gates + report). Đó là cách duy nhất báo việc cho git-bot.
- Git-bot **chỉ** làm một việc: canh `BRANCHES.md`; mỗi lần nội dung đổi (background watcher báo) → đọc lại file từ đầu → lấy nhánh `ready` đầu tiên → merge vào `origin/main` theo "Quy trình merge" (worktree detached từ `origin/main` mới nhất → gates → commit merge `--no-ff` → push → deploy/tag nếu `Request` yêu cầu) → ghi `merged <sha>` vào entry + commit cập nhật registry → dọn worktree + `git branch -d` → re-arm watcher.
- Không có nhánh `ready` (chỉ `active`/`merged`/`rejected`) → **không merge gì**, báo cáo ngắn và re-arm watcher.
- Commit trong một lượt merge gồm: (1) merge commit `--no-ff` của nhánh, (2) commit cập nhật `BRANCHES.md` (`merged <sha>`) — cùng push lên `origin/main`; tag do `scripts/deploy.sh` sinh khi có deploy.
- `BRANCHES.md` là **local-only (git-ignored)**: registry phối hợp trên máy này, không commit/push; các agent khác ghi trực tiếp vào file này. Watcher bắt mọi thay đổi qua lệnh `/watch-branches` (`.agents/bot/git/.opencode/commands/watch-branches.md`).
- Ngoài watcher `BRANCHES.md` không có nguồn việc nào khác cho bot này.

## Local Contracts

- **Không bot/agent nào tự merge nhánh.** CEO/chat chỉ: verify → ghi nhánh `ready` vào `BRANCHES.md` → dọn worktree của agent → `hc kill`/`hc rm`. Toàn bộ merge/push/deploy/tag thuộc git-bot này.
- Một thời điểm một nhánh. Không bao giờ merge nhánh chưa `ready`; không force-push; không `-D` nhánh chưa merge vào `origin/main`.
- Mỗi nhánh được merge trong **detached worktree** tách từ `origin/main` mới nhất (không merge từ shared tree đang bẩn của phiên khác).

## BRANCHES.md format (mỗi mục một nhánh)

```
## <branch> — <status>
- Status: active | ready | merged <sha> | rejected <reason>
- Worktree: <path> (hoặc "removed")
- Base: <sha>
- Owner: <session/agent id> — <task slug>
- Task: <một dòng>
- Gates: (chưa chạy) | build ✅ typecheck ✅ tests <n>/<n> ✅ screenshots <paths>
- Report: <path nếu có>
- Request: merge → origin/main [+ deploy, tag]
- Notes: …
```

Lifecycle: người/agent sở hữu nhánh ghi `active` khi nhánh xuất hiện → sau khi agent idle + verify xong, đặt `ready` (điền gates + report) → git-bot merge → `merged <sha>` (+ deploy nếu `Request` có deploy; tag nếu origin/main == sha) → dọn worktree + `git branch -d` → báo lại.

`active` nghĩa là **chưa được đụng vào** — không merge, không rebase, không xoá.

## Quy trình merge (mỗi nhánh một lượt)

1. `git fetch origin`; đọc `BRANCHES.md`; chọn nhánh `ready` **đầu tiên chưa bị ghi chú chặn** (thứ tự file). Nếu không có → dừng, không làm gì.
2. Detached worktree từ `origin/main` mới nhất; `git merge --no-ff <branch>`.
3. Doc conflicts → hợp nhất theo kiểu union (giữ cả hai ý, không xoá nội dung nào có nguồn); sau merge **LUÔN** `grep -n -F '<<<<<<<'` trên mọi file đã đụng — không marker nào được phép ở commit. Code conflicts ngoài docs/scripts → `rejected` (trả lại owner), không tự ý sáng tạo.
4. Chạy gates trong merge worktree: `bun install --frozen-lockfile` (root), `cd apps/web && bun run build && bun run typecheck && bun run test` (backend `readings` fail là pre-existing). Fail → `rejected` với log, không push.
5. Push `origin/main`. Nếu `Request` yêu cầu deploy: chạy `scripts/deploy.sh` (một deploy tại một thời điểm máy; không deploy khi có deploy khác đang chạy — nếu đang có, bỏ qua deploy, ghi chú). Tag sinh tự động bởi script.
6. Cập nhật entry `merged <sha>`; rồi **dọn sạch nhánh ngay trong cùng lượt** (xem "Clear sau merge"); HC-AGENTS.md (ceo) một dòng nếu có deploy.

## Clear sau merge — bắt buộc (Keios, 2026-11-15)

- Merge đã push lên `origin/main` xong thì nhánh đó không còn lý do tồn tại — xoá cùng lượt, không để lại "rác nhánh":
  1. `git worktree remove --force <path>` (worktree của agent, thường `/tmp/opencode/*` hoặc `/home/keios/repos/mein/nsac-*`) → `git worktree prune`.
  2. `git branch -d <branch>` (chỉ `-d`; từ chối xoá nghĩa là chưa merge — dừng, điều tra, không dùng `-D`).
  3. Nếu nhánh có trên remote: `git push origin --delete <branch>` (chỉ sau khi merge commit đã nằm trong `origin/main`; không xoá remote branch chưa merge).
  4. Verify: `git branch -a | grep -F <branch>` và `git worktree list` không còn nhánh/worktree đó; `git status --short` sạch.
- Registry `BRANCHES.md`: entry chuyển `merged <sha>`, `Worktree: removed`, `Notes` ghi nhánh đã xoá — commit cùng lượt.
- Không xoá nhánh `active`/`rejected`/chưa merge, không xoá `main`, không đụng nhánh của agent đang chạy.
- **Không bao giờ xoá worktree `deploy-*`** (`/home/keios/nsac.worktrees/deploy-<sha>`) — chúng thuộc `scripts/deploy.sh`, có thể đang là nguồn rsync của một deploy đang chạy. Trước khi xoá bất kỳ worktree/branch nào: `pgrep -af 'deploy\.sh|nix build'` phải trống (bài học 2026-11-15: xoá nhầm worktree deploy đang chạy, phải dựng lại cùng sha ngay).
- Nếu xoá thất bại (branch chưa merge đúng, worktree còn lock): ghi `Notes` lý do, báo Keios, không ép `-D`, không bỏ qua im lặng.

## Background watch — luôn có một shell chờ thay đổi `BRANCHES.md` (Keios, 2026-11-15)

- **Bất biến: luôn có đúng MỘT background shell đang chờ thay đổi của `BRANCHES.md`.** Đầu mỗi lượt, trước khi làm việc khác, kiểm tra `pgrep -af watch-branches.sh`; chưa có → mở ngay. Không bao giờ để bot ở trạng thái "không ai canh".
- Mở bằng tool `shell` với `background: true`, chạy từ repo root:

  ```bash
  .opencode/plugins/watch-branches.sh 7200
  ```

- Harness báo khi watcher kết thúc — đó là tín hiệu làm việc, không phải lỗi:
  - exit `0` = nội dung `BRANCHES.md` đã đổi → đọc lại **từ đầu**, chạy đúng một lượt merge nếu có nhánh `ready` (theo "Quy trình merge"), chỉ báo cáo nếu không có, rồi **mở watcher mới ngay**.
  - exit `2` = 7200s không đổi → mở watcher mới, không coi là fail, không merge gì thêm.
- Watcher so **sha256** nội dung với `.watch-state` (local, git-ignored): `touch`/đổi mtime mà nội dung y nguyên thì không đánh thức bot; nội dung đổi hoặc file bị xoá/tạo lại đều tính là thay đổi.
- Cấm `sleep`/poll thủ công trong chat để chờ file — chỉ dựa vào background watcher (cùng tinh thần luật `hc wait` ở root AGENTS.md).
- Muốn ép đọc lại: xoá `.watch-state` rồi arming lại theo nội dung hiện tại.

## Restraint

- Không deploy hộ nhánh khác; không mở rộng scope; không sửa code của nhánh đang `active`; không commit rác vào main; khi mơ hồ → `rejected <lý do>` và hỏi Keios/CEO.
- `BRANCHES.md` là dữ liệu điều phối, không chứa secret, không chứa dữ liệu cá nhân thật.
