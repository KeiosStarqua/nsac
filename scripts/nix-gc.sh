#!/usr/bin/env bash
# nix-gc.sh — dọn store path mồ côi của các bản deploy nsac cũ trên box OpfaOS.
#
# An toàn nhờ gcroots: /nix/var/nix/gcroots/nsac-{web,backend} phải là symlink
# tới store path đang chạy (systemd ExecStart đi qua ~/nsac/result[-backend]).
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
  local name="$1" expect_substr="$2" link="$GCROOT_DIR/$1" target
  [ -L "$link" ] || fail "gcroot $link missing or not a symlink"
  target=$(readlink -f "$link") || fail "gcroot $link dangles"
  [[ "$target" == /nix/store/* ]] || fail "gcroot $link → '$target' is not a store path"
  [ -e "$target" ] || fail "gcroot target $target does not exist"
  [[ "$target" == *"$expect_substr"* ]] || fail "gcroot $link → '$target' does not look like $expect_substr"
  echo "nix-gc: gcroot $name → $target (ok)"
}

check_gcroot nsac-web  -nsac-web-
check_gcroot nsac-backend -nsac-backend-

# Nếu systemd có unit nsac-web, ExecStart phải resolve đúng gcroot target
# (bảo vệ trường hợp ai đó đổi result mà quên gcroot).
if command -v systemctl >/dev/null && systemctl list-units --full -all --no-legend 'nsac-web.service' 2>/dev/null | grep -q nsac-web; then
  exec_path=$(systemctl show -p ExecStart --value nsac-web.service | grep -oE '/nix/store/[^ ]*nsac-web[^ "]*' | head -1 || true)
  if [ -n "$exec_path" ]; then
    resolved=$(readlink -f "$exec_path")
    web_root=$(readlink -f "$GCROOT_DIR/nsac-web")
    # ExecStart trỏ tới ~/nsac/result/bin/nsac-web → resolve ra store path; prefix phải khớp gcroot
    [[ "$resolved" == "$web_root"/* ]] || fail "nsac-web ExecStart resolves to $resolved, outside gcroot $web_root"
    echo "nix-gc: nsac-web ExecStart under gcroot (ok)"
  fi
fi

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
