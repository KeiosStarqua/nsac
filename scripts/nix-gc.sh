#!/usr/bin/env bash
# nix-gc.sh — dọn store path mồ côi của các bản deploy nsac cũ trên box OpfaOS.
#
# An toàn nhờ 5 gcroots: /nix/var/nix/gcroots/nsac-{web,backend,inference,marimo} phải là
# symlink tới store path đang chạy (systemd ExecStart đi qua ~/nsac/result*), và
# /nix/var/nix/gcroots/nsac-web-node-modules phải trỏ tới FOD node_modules.
# FOD đó là BUILD-TIME input: không output runtime nào tham chiếu nó, nên thiếu gcroot
# là GC xoá sạch → deploy sau phải `bun install` lại → hash lệch outputHash → nix build fail.
# Script TỪ CHỐI chạy nếu gcroot thiếu/hỏng/không trỏ tới path *-nsac-*-* còn tồn tại,
# hoặc systemd service đang ExecStart path khác với gcroot (lệch = không rõ bản nào
# đang sống, không xóa gì cả).
#
# DRY_RUN=1 ./scripts/nix-gc.sh  — chỉ liệt kê path dead, không xóa.
# (qua sudo phải dùng env: sudo -n env DRY_RUN=1 bash scripts/nix-gc.sh — sudo env_reset sẽ bỏ DRY_RUN)
set -euo pipefail

GCROOT_DIR="${GCROOT_DIR:-/nix/var/nix/gcroots}"
NIX_STORE="${NIX_STORE:-$(command -v nix-store || true)}"
[ -n "$NIX_STORE" ] || NIX_STORE=/root/.nix-profile/bin/nix-store

df_before=$(df -h / | tail -1)

fail() { echo "nix-gc: REFUSING TO RUN: $*" >&2; exit 1; }

check_gcroot() {
  local name="$1" expect_substr="$2" link="$GCROOT_DIR/$1" target text
  [ -L "$link" ] || fail "gcroot $link missing or not a symlink"
  text=$(readlink "$link") || fail "gcroot $link unreadable"
  # nix không đi qua symlink trung gian: gcroot phải TRỰC TIẾP là store path,
  # không được là symlink trỏ tới ~/nsac/result[-backend] (2026-11-14: result-backend
  # bị rsync xoá → gcroot "resolve" được nhưng nix GC vẫn xoá backend store path → 203/EXEC).
  [[ "$text" == /nix/store/* ]] || fail "gcroot $link → '$text' is not a direct store path (pin with: ln -sfn \"\$(readlink -f ~/nsac/result[-backend|-node-modules|-inference|-marimo])\" $GCROOT_DIR/$name)"
  target=$(readlink -f "$link") || fail "gcroot $link dangles"
  [ -e "$target" ] || fail "gcroot target $target does not exist"
  [[ "$target" == *"$expect_substr"* ]] || fail "gcroot $link → '$target' does not look like $expect_substr"
  echo "nix-gc: gcroot $name → $target (ok)"
}

check_gcroot nsac-web  -nsac-web-
check_gcroot nsac-backend -nsac-backend-
# Service ML: #out của .#inference (wrapper + venv) và giữ luôn reference tới FOD wheelhouse
# qua share/inference-wheels ⇒ một root bảo vệ cả hai.
check_gcroot nsac-inference -nsac-inference-
# Service notebooks: #out của .#marimo giữ reference tới FOD wheelhouse qua share/marimo-wheels
# (và venv nằm ngay trong #out) ⇒ một root bảo vệ cả hai.
check_gcroot nsac-marimo -nsac-marimo-
# FOD node_modules: build-time input, không runtime reference → phải có gcroot riêng.
# Thiếu root này = chưa deploy bằng deploy.sh mới; từ chối GC, đừng xoá FOD.
check_gcroot nsac-web-node-modules -nsac-web-node-modules-

# Nếu systemd có unit nsac-{web,backend,inference,marimo}, ExecStart phải resolve đúng gcroot target
# (bảo vệ trường hợp ai đó đổi result mà quên gcroot).
check_unit_execstart() {
  local svc="$1" root_name="$2" glob="$3"
  command -v systemctl >/dev/null && systemctl list-units --full -all --no-legend "$svc" 2>/dev/null | grep -q "${svc%.service}" || return 0
  local exec_path resolved root
  # systemd báo path ĐÚNG NHƯ ĐÃ CẤU HÌNH (vd. /home/ec2-user/nsac/result/bin/nsac-web), KHÔNG phải
  # store path — nên phải tự `readlink -f` qua out-link ~/nsac/result* rồi mới so với gcroot.
  exec_path=$(systemctl show -p ExecStart --value "$svc" | grep -oE 'path=[^ ;]*' | head -1 | cut -d= -f2- || true)
  [ -n "$exec_path" ] || return 0
  resolved=$(readlink -f "$exec_path" 2>/dev/null) || resolved=""
  [[ "$resolved" == /nix/store/*"$glob"* ]] || fail "$svc ExecStart '$exec_path' resolves to '$resolved' — không phải store path $glob (không rõ bản nào đang sống)"
  root=$(readlink -f "$GCROOT_DIR/$root_name")
  # ExecStart trỏ tới ~/nsac/result[-backend|-inference]/bin/* → resolve ra store path; prefix phải khớp gcroot
  [[ "$resolved" == "$root"/* ]] || fail "$svc ExecStart resolves to $resolved, outside gcroot $root"
  echo "nix-gc: $svc ExecStart under gcroot (ok)"
}
check_unit_execstart nsac-web.service nsac-web 'nsac-web'
check_unit_execstart nsac-backend.service nsac-backend 'nsac-backend'
check_unit_execstart nsac-inference.service nsac-inference 'nsac-inference'
check_unit_execstart nsac-marimo.service nsac-marimo 'nsac-marimo'

echo "nix-gc: dead paths (before):"
"$NIX_STORE" --gc --print-dead | wc -l
if [[ "${DRY_RUN:-0}" == "1" ]]; then
  echo "nix-gc: DRY_RUN=1 — not deleting. Dead path list:"
  "$NIX_STORE" --gc --print-dead
  echo "nix-gc: df before: $df_before"
  exit 0
fi

"$NIX_STORE" --gc
echo "nix-gc: df before: $df_before"
echo "nix-gc: df after:  $(df -h / | tail -1)"
