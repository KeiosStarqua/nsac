# Git Bot — merge gate qua BRANCHES.md

## Purpose

Hợp nhất mọi nhánh code/doc của các bot/agent vào `origin/main` — một cách có kiểm soát, không ai tự merge trong chat. Registry duy nhất: `BRANCHES.md` (cùng thư mục).

## Nhiệm vụ — vòng watch → merge (Keios, 2026-11-15)

- Agent/CEO làm xong code → tự ghi nhánh của mình vào `BRANCHES.md` với `Status: ready` (+ gates + report). Đó là cách duy nhất báo việc cho git-bot.
- Git-bot nghe hai tín hiệu từ **một** watcher `.opencode/plugins/watch-branches.sh` (xem "Background watch"):
  - `CHANGED: BRANCHES…` → canh `BRANCHES.md`; mỗi lần nội dung đổi (background watcher báo) → đọc lại file từ đầu → lấy nhánh `ready` đầu tiên → merge vào `origin/main` theo "Quy trình merge" (worktree detached từ `origin/main` mới nhất → gates → commit merge `--no-ff` → push → deploy/tag nếu `Request` yêu cầu) → ghi `merged <sha>` vào entry + commit cập nhật registry → dọn worktree + `git branch -d` → re-arm watcher.
  - `CHANGED: TREE…` → working tree (chưa commit) đổi → xem "Commit trực tiếp trên `main`" bên dưới: **xem xét và có thể commit** các thay đổi rời trên `main` (không chờ nhánh), hoặc để nguyên nếu là WIP đang dở của phiên khác. Không merge nhánh, không deploy.
  - `CHANGED: BRANCHES+TREE…` → làm cả hai, **BRANCHES trước** (một nhánh mỗi lượt), rồi TREE.
- Không có nhánh `ready` (chỉ `active`/`merged`/`rejected`) → **không merge gì**, báo cáo ngắn và re-arm watcher.
- Commit trong một lượt merge gồm: (1) merge commit `--no-ff` của nhánh, (2) commit cập nhật `BRANCHES.md` (`merged <sha>`) — cùng push lên `origin/main`; tag do `scripts/deploy.sh` sinh khi có deploy.
- `BRANCHES.md` là **local-only (git-ignored)**: registry phối hợp trên máy này, không commit/push; các agent khác ghi trực tiếp vào file này. Watcher bắt mọi thay đổi qua lệnh `/watch-branches` (`.agents/bot/git/.opencode/commands/watch-branches.md`).
- Tín hiệu TREE **không** phải là merge queue thứ hai: nó chỉ cho phép commit trực tiếp trên `main`, không được dùng để merge/rebase nhánh của ai, và không tự deploy.

## Commit trực tiếp trên `main` — tín hiệu TREE (Keios, 2026-11-17)

Khi watcher báo `CHANGED: TREE…` (hoặc `BRANCHES+TREE`), bot **xem xét** rồi mới quyết định — không commit mù:

1. `git fetch origin`; `git status --porcelain=v1 -uall`; `git diff --stat`. Nếu tree sạch → re-arm, không làm gì.
2. Phân loại từng nhóm thay đổi:
   - **Tự chứa, hoàn chỉnh** (một coherent change: docs/config/script/code nhỏ, nội dung khớp với commit trước — ví dụ agent vừa sửa xong doc nội bộ và quên commit) → commit trên `main` với message một dòng tiếng Anh (`docs(...)`/`feat(...)`/`fix(...)`) → `git push origin main` ngay (luật root: push sau mỗi commit).
   - **WIP đang dở** (file được sửa nhiều lần trong phiên khác, sửa một mảnh của feature đang làm, nội dung mâu thuẫn giữa các file) → **KHÔNG commit**, báo ngắn gọn và để nguyên cho phiên sở hữu. Khi mơ hồ → để nguyên, hỏi Keios.
3. Không bao giờ commit: secrets/key (`.env`, `var/`, `*.pem`, `sk-*`), `BRANCHES.md` và `.watch-state` (local-only), `node_modules/`, output build (`.output/`, `.turbo/`), thay đổi con trỏ submodule `data/` (phải đi theo repo nsac-data, không bump mù), hoặc bất kỳ file nào đang được phiên khác chỉnh **ngay trong lúc** bạn kiểm (kiểm `git diff` hai lần cách nhau vài giây; nội dung đổi giữa hai lần → dừng, để nguyên).
4. Sau khi commit TREE: tree lại sạch → re-arm watcher như thường lệ. Chú ý: commit làm `git diff HEAD` rỗng/đổi HEAD nên watcher có thể báo `CHANGED: TREE` một lần nữa ngay sau commit — đó là no-op dự kiến (re-arm sẽ re-seed), không lặp commit.
5. TREE commit **không deploy**: deploy/tag vẫn chỉ đi qua "Quy trình merge" (nhánh `ready` trong `BRANCHES.md`) hoặc lệnh rõ ràng của Keios. Docs-only TREE commit không cần deploy.
6. Nếu main có cả nhánh `ready` và file rời: merge nhánh theo quy trình, rồi mới xét file rời ở cuối — mỗi lượt chỉ một nhánh.

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
2. **Merge trên local `main` rồi push** (Keios, 2026-11-16): luôn fast-forward local `main` theo `origin/main` trước (`git merge --ff-only origin/main`) — shared tree phải nằm trên tip mới nhất trước khi chạm vào; sau đó merge `--no-ff <branch>` trực tiếp trên local `main` (trong shared tree, DOX chain vẫn được tôn trọng), hoặc trong detached worktree từ local `main` nếu cần cách ly. Sau push, local `main` và `origin/main` phải trùng sha — **luôn giữ "main on remote" và "main local" sync**, không merge lệch (app/deploy đọc `origin/main`; session code đọc local). Trước khi push luôn xác minh `git status --short` sạch và `git log` đúng series.
3. Doc conflicts → hợp nhất theo kiểu union (giữ cả hai ý, không xoá nội dung nào có nguồn); sau merge **LUÔN** `grep -n -F '<<<<<<<'` trên mọi file đã đụng — không marker nào được phép ở commit. Code conflicts ngoài docs/scripts → `rejected` (trả lại owner), không tự ý sáng tạo.
4. Chạy gates trong merge worktree: `bun install --frozen-lockfile` (root), `cd apps/web && bun run build && bun run typecheck && bun run test` (backend `readings` fail là pre-existing). Fail → `rejected` với log, không push.
5. Push `origin/main`. Sau khi push xong, **deploy luôn** (`scripts/deploy.sh`, Keios 2026-11-16 — "merge/commit xong là deploy"): không chờ Keios chốt; chỉ bỏ deploy khi nhánh/registry có lệnh cấm deploy rõ ràng. Một deploy tại một thời điểm máy; nếu đang có deploy khác chạy, bỏ qua deploy lượt này và ghi chú. Tag sinh tự động bởi script. **Deploy chỉ do git-bot chạy** (Keios, 2026-11-16): agent tại repo root không được deploy; chỉ bot dưới `.agents/bot/git` mới được gọi `scripts/deploy.sh`.
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

## Background watch — luôn có một shell chờ thay đổi `BRANCHES.md` HOẶC working tree (Keios, 2026-11-15, mở rộng 2026-11-17)

- **Bất biến: luôn có đúng MỘT background shell đang chạy `watch-branches.sh`.** Đầu mỗi lượt, trước khi làm việc khác, kiểm tra `pgrep -af watch-branches.sh`; chưa có → mở ngay. Không bao giờ để bot ở trạng thái "không ai canh".
- Mở bằng tool `shell` với `background: true`, chạy từ repo root:

  ```bash
  .agents/bot/git/.opencode/plugins/watch-branches.sh 7200
  ```

- Watcher theo dõi **hai tín hiệu** trong một tiến trình:
  - `BRANCHES` — sha256 của `BRANCHES.md` (như trước).
  - `TREE` — sha256 của `git status --porcelain=v1 -uall` + `git diff HEAD` + stat(size,mtime) của các file untracked (bắt mọi thay đổi chưa commit: sửa file tracked, thêm/xoá file untracked, sửa nội dung, kể cả chmod/touch).
- Harness báo khi watcher kết thúc — đó là tín hiệu làm việc, không phải lỗi:
  - exit `0` → có thay đổi; dòng `CHANGED:` cho biết tín hiệu nào nổ:
    - `BRANCHES` (hoặc `BRANCHES+TREE`) → đọc lại registry **từ đầu**; có nhánh `ready` → chạy đúng một lượt merge (theo "Quy trình merge"); không có → báo cáo ngắn; sau đó (với `BRANCHES+TREE`) xét tiếp phần TREE; rồi **mở watcher mới ngay**.
    - `TREE` (hoặc `BRANCHES+TREE`) → `git status` + `git diff --stat`; nếu có thay đổi rời → xét theo "Commit trực tiếp trên `main`"; xong → **mở watcher mới ngay**.
  - exit `2` = 7200s không đổi → mở watcher mới, không coi là fail, không làm gì thêm.
- Watcher lưu cặp hash vào `.watch-state` (local, git-ignored, format hai dòng `branches=<sha>` / `tree=<sha>`; file cũ một dòng được tự re-seed).
- `.watch-state` được viết lại mỗi lần watcher chốt trạng thái (arm hoặc wake) → sau mỗi commit/deploy main, tree hash đổi → watcher có thể wake một lần no-op; re-arm lúc này chỉ cần xoá `.watch-state` rồi mở lại (hoặc để nó tự seed).
- Blind spots đã biết: thay đổi bên trong submodule `data/` (chỉ hiện thành một dòng status), file bị `.gitignore`, và đổi tên file giữ nguyên nội dung path. Chấp nhận được — các cú false-wake chỉ tốn một lần kiểm tra.
- Cấm `sleep`/poll thủ công trong chat để chờ file — chỉ dựa vào background watcher (cùng tinh thần luật `hc wait` ở root AGENTS.md).
- Muốn ép đọc lại: xoá `.watch-state` rồi arm lại bình thường (watcher tự seed hash hiện tại).

## Plugin wake-up — `.agents/bot/git/plugins/watch-branches/` (Keios, 2026-11-15)

- Plugin server chạy trong OpenCode: poll `BRANCHES.md` mỗi 5s; khi xuất hiện entry `Status: ready` mới → `client.session.prompt` vào session cập nhật gần nhất, tạo turn thật để bot merge. Không thể dựa vào process nền do plugin spawn (harness chỉ báo shell do tool `shell` mở).
- Đăng ký trong `opencode.jsonc` cùng thư mục, **absolute path** (`/home/keios/repos/mein/nsac/.agents/bot/git/plugins/watch-branches`) — path tương đối resolve theo cwd của background service, không theo repo root.
- Plugin local-dir **phải có `package.json`** (`exports: { ".": "./index.ts" }`), thiếu là "Plugin failed to load".
- Log: `~/.local/state/opencode/watch-branches.log`. Sau khi sửa plugin phải restart OpenCode.

## Restraint

- Không deploy hộ nhánh khác; không mở rộng scope; không sửa code của nhánh đang `active`; không commit rác vào main; khi mơ hồ → `rejected <lý do>` và hỏi Keios/CEO.
- `BRANCHES.md` là dữ liệu điều phối, không chứa secret, không chứa dữ liệu cá nhân thật.
