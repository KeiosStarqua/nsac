# Git Bot — merge gate qua BRANCHES.md

## Purpose

Hợp nhất mọi nhánh code/doc của các bot/agent vào `origin/main` — một cách có kiểm soát, không ai tự merge trong chat. Registry duy nhất: `BRANCHES.md` (cùng thư mục).

Phối hợp với ops (`.agents/bot/ops`, Keios 2026-11-17): git-bot chỉ **merge + push**; build/test/deploy sau push do **ops** thực thi theo yêu cầu trong `.agents/bot/ops/OPS.md`. Git-bot không tự chạy gates/`scripts/deploy.sh`; merge xong chỉ **ghi entry vào `OPS.md`** rồi trả về watcher.

## Nhiệm vụ — vòng watch → merge (Keios, 2026-11-15)

- Agent/CEO làm xong code → tự ghi nhánh của mình vào `BRANCHES.md` với `Status: ready` (+ gates + report). Đó là cách duy nhất báo việc cho git-bot.
- Git-bot nghe hai tín hiệu từ **một** watcher `.opencode/plugins/watch-branches.sh` (xem "Background watch"):
  - `CHANGED: BRANCHES…` → canh `BRANCHES.md`; mỗi lần nội dung đổi (background watcher báo) → đọc lại file từ đầu → lấy nhánh `ready` đầu tiên → merge vào `origin/main` theo "Quy trình merge" (worktree detached từ `origin/main` mới nhất → commit merge `--no-ff` → push → **ghi entry vào `../ops/OPS.md`** cho ops test/deploy) → ghi `merged <sha>` vào entry + commit cập nhật registry → dọn worktree + `git branch -d` → re-arm watcher.
  - `CHANGED: TREE…` → working tree (chưa commit) đổi → xem "Commit trực tiếp trên `main`" bên dưới: **xem xét và có thể commit** các thay đổi rời trên `main` (không chờ nhánh), hoặc để nguyên nếu là WIP đang dở của phiên khác. Không merge nhánh, không deploy.
  - `CHANGED: BRANCHES+TREE…` → làm cả hai, **BRANCHES trước** (một nhánh mỗi lượt), rồi TREE.
- Không có nhánh `ready` (chỉ `active`/`merged`/`rejected`) → **không merge gì**, báo cáo ngắn và re-arm watcher.
- Commit trong một lượt merge gồm: (1) merge commit `--no-ff` của nhánh, (2) commit cập nhật `BRANCHES.md` (`merged <sha>`) — cùng push lên `origin/main`. Build/test/deploy cho sha đó không do git-bot chạy: git-bot ghi entry `OPS.md`, **ops** thực thi; tag do `scripts/deploy.sh` sinh khi ops chạy deploy.
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
5. TREE commit **không deploy**, nhưng vẫn được ops test: sau khi push, ghi entry `Request: test` vào `OPS.md` (Source: tree-commit) — mọi commit trên `main` đều đi qua ops theo thứ tự. Docs-only TREE commit: ghi entry `test` như thường; deploy chỉ phát sinh từ merge push (mặc định) hoặc lệnh rõ ràng của Keios.
6. Nếu main có cả nhánh `ready` và file rời: merge nhánh theo quy trình, rồi mới xét file rời ở cuối — mỗi lượt chỉ một nhánh.

## Local Contracts

- **Không bot/agent nào tự merge nhánh.** CEO/chat chỉ: verify → ghi nhánh `ready` vào `BRANCHES.md` → dọn worktree của agent → `hc kill`/`hc rm`. Merge/push thuộc git-bot; **build/test/deploy thuộc ops** (`.agents/bot/ops`) theo yêu cầu trong `OPS.md` — git-bot không tự chạy chúng.
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
- Gates: (ops chưa báo) | ops `<sha-12>` pass ✅ | fail <tóm tắt> (lấy từ kết quả ops sau khi sha được test)
- Report: <path nếu có>
- Request: merge → origin/main [+ deploy, tag]
- Notes: …
```

Lifecycle: người/agent sở hữu nhánh ghi `active` khi nhánh xuất hiện → sau khi agent idle + verify xong, đặt `ready` (điền gates nếu team tự chạy, hoặc để trống chờ ops + report) → git-bot merge + push → ghi entry `OPS.md` (ops test/deploy) → `merged <sha>` → dọn worktree + `git branch -d` → báo lại (kết quả test/deploy lấy từ `OPS.md` khi ops xong).

`active` nghĩa là **chưa được đụng vào** — không merge, không rebase, không xoá.

## Quy trình merge (mỗi nhánh một lượt)

1. `git fetch origin`; đọc `BRANCHES.md`; chọn nhánh `ready` **đầu tiên chưa bị ghi chú chặn** (thứ tự file). Nếu không có → dừng, không làm gì.
2. **Merge trên local `main` rồi push** (Keios, 2026-11-16): luôn fast-forward local `main` theo `origin/main` trước (`git merge --ff-only origin/main`) — shared tree phải nằm trên tip mới nhất trước khi chạm vào; sau đó merge `--no-ff <branch>` trực tiếp trên local `main` (trong shared tree, DOX chain vẫn được tôn trọng), hoặc trong detached worktree từ local `main` nếu cần cách ly. Sau push, local `main` và `origin/main` phải trùng sha — **luôn giữ "main on remote" và "main local" sync**, không merge lệch (app/deploy đọc `origin/main`; session code đọc local). Trước khi push luôn xác minh `git status --short` sạch và `git log` đúng series.
3. Doc conflicts → hợp nhất theo kiểu union (giữ cả hai ý, không xoá nội dung nào có nguồn); sau merge **LUÔN** `grep -n -F '<<<<<<<'` trên mọi file đã đụng — không marker nào được phép ở commit. Code conflicts ngoài docs/scripts → `rejected` (trả lại owner), không tự ý sáng tạo.
4. Push `origin/main`. **Không chạy gates trong git-bot** (Keios, 2026-11-17): sau push ghi entry vào `/home/keios/repos/mein/nsac/.agents/bot/ops/OPS.md` — tạo file nếu chưa có, **nối vào cuối** (thứ tự file = thứ tự xử lý của ops):

   ```
   ## <sha-12> — queued
   - Status: queued
   - Sha: <sha đầy đủ vừa push>
   - Request: test+deploy    (mặc định; nhánh/registry có "KHÔNG deploy" rõ ràng → `test`)
   - Source: merge <branch>
   - Requester: git-bot
   - Queued: <ts>
   - Log: logs/<sha-12>.log
   - Result: (chưa chạy)
   - Notes: <branch> merged --no-ff
   ```

   Ops lần lượt build/test từng sha theo thứ tự file và deploy sau khi test pass (`scripts/deploy.sh <sha>`, một deploy tại một thời điểm máy, tag do script sinh). Deploy mặc định vẫn chạy sau merge — chỉ khác: do ops chạy, qua `OPS.md`, **sau khi test pass**; test fail → ops dừng hàng, không deploy, báo Keios. Git-bot không chờ ops xong mới kết lượt.
5. Cập nhật entry `merged <sha>`; rồi **dọn sạch nhánh ngay trong cùng lượt** (xem "Clear sau merge"); HC-AGENTS.md (ceo) một dòng nếu có deploy được yêu cầu.

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

## Background watch — sentinel monitor canh `BRANCHES.md` + working tree (Keios, 2026-11-17)

- **Bất biến: luôn có đúng MỘT sentinel monitor (`tools.sentinel_monitor`) canh hai tín hiệu.** `tools.sentinel_list()` phải luôn hiển thị nó; chết/mất → `sentinel_stop` + `sentinel_monitor` tạo lại monitor mới ngay. Không chạy shell watcher song song với sentinel.
- Monitor chạy poll mỗi 5s trên **hai tín hiệu cùng lúc** (cùng logic bản shell watcher cũ, giữ nguyên test/không đổi semantics):
  - `BRANCHES` — sha256 của `BRANCHES.md`.
  - `TREE` — sha256 của `git status --porcelain=v1 -uall` + `git diff HEAD` + stat(size,mtime) của các file untracked.
- Filter `GIT-BOT-WAKE` — chỉ các dòng in ra khớp mới notify; dòng `armed` không ồn. Khi có thay đổi, monitor in:
  - `GIT-BOT-WAKE branches <old> -> <new>`, `GIT-BOT-WAKE tree <old> -> <new>`, hoặc cả hai.
- Harness notify khi có `GIT-BOT-WAKE` → bot đọc lại registry **từ đầu** + `git status`:
  - `BRANCHES` → lấy nhánh `ready` đầu tiên, chạy đúng một lượt merge (theo "Quy trình merge"); không có → báo cáo ngắn.
  - `TREE` → xét theo "Commit trực tiếp trên `main`" (doc/config nhỏ hoàn chỉnh → commit + push + OPS.md entry; WIP khác → để nguyên và báo).
  - Cả hai → BRANCHES trước, rồi TREE.
- Monitor **không** cần re-arm sau mỗi lượt — nó chạy liên tục trong nền. Muốn dừng/kiểm tra: `sentinel_list()`; dừng: `sentinel_stop({id})`.
- Start (dùng đúng command này khi cần làm lại monitor):

  ```js
  tools.sentinel_monitor({
    command: "bash -c 'BR=\"/home/keios/repos/mein/nsac/.agents/bot/git/BRANCHES.md\"; R=\"/home/keios/repos/mein/nsac\"; prev=\"\"; while :; do b=$(sha256sum \"$BR\" | cut -d\" \" -f1); t=$(cd \"$R\" && { git status --porcelain=v1 -uall; printf \"\0\"; git diff HEAD; printf \"\0\"; git ls-files -o --exclude-standard -z | xargs -0 -r stat -c \"%n:%s:%Y\"; } | sha256sum | cut -d\" \" -f1); cur=\"$b $t\"; if [ -z \"$prev\" ]; then prev=\"$cur\"; echo \"git-bot watch armed branches=$b tree=$t\"; sleep 5; continue; fi; if [ \"$cur\" != \"$prev\" ]; then pb=\"${prev%% *}\"; pt=\"${prev##* }\"; if [ \"$b\" != \"$pb\" ] && [ \"$t\" != \"$pt\" ]; then echo \"GIT-BOT-WAKE branches $pb -> $b tree $pt -> $t\"; elif [ \"$b\" != \"$pb\" ]; then echo \"GIT-BOT-WAKE branches $pb -> $b\"; else echo \"GIT-BOT-WAKE tree $pt -> $t\"; fi; prev=\"$cur\"; fi; sleep 5; done'",
    description: "git-bot nsac: BRANCHES.md + working tree watch (GIT-BOT-WAKE)",
    filter: "GIT-BOT-WAKE"
  })
  ```

- `plugins/watch-branches.sh` (+ `.opencode/scripts/watch-branches-start.sh`) giữ làm **fallback** khi sentinel plugin hỏng — không chạy song song; `.watch-state` không còn được dùng (xoá khi thấy file).
- Blind spots đã biết: thay đổi bên trong submodule `data/` (chỉ hiện thành một dòng status), file bị `.gitignore`, và đổi tên file giữ nguyên nội dung path. False-wake chỉ tốn một lần kiểm tra.
- Cấm `sleep`/poll thủ công trong chat để chờ file — sentinel monitor là cơ chế duy nhất (cùng tinh thần luật `hc wait`).

## Plugin wake-up — `.agents/bot/git/plugins/watch-branches/` (Keios, 2026-11-15)

- Plugin server chạy trong OpenCode: poll `BRANCHES.md` mỗi 5s; khi xuất hiện entry `Status: ready` mới → `client.session.prompt` vào session cập nhật gần nhất, tạo turn thật để bot merge. Không thể dựa vào process nền do plugin spawn (harness chỉ báo shell do tool `shell` mở).
- Đăng ký trong `opencode.jsonc` cùng thư mục, **absolute path** (`/home/keios/repos/mein/nsac/.agents/bot/git/plugins/watch-branches`) — path tương đối resolve theo cwd của background service, không theo repo root.
- Plugin local-dir **phải có `package.json`** (`exports: { ".": "./index.ts" }`), thiếu là "Plugin failed to load".
- Log: `~/.local/state/opencode/watch-branches.log`. Sau khi sửa plugin phải restart OpenCode.

## Restraint

- Không tự chạy build/test/deploy hộ nhánh khác (việc đó thuộc ops qua `OPS.md`); không mở rộng scope; không sửa code của nhánh đang `active`; không commit rác vào main; khi mơ hồ → `rejected <lý do>` và hỏi Keios/CEO.
- `BRANCHES.md` là dữ liệu điều phối, không chứa secret, không chứa dữ liệu cá nhân thật.
