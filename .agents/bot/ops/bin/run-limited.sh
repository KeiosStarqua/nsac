#!/usr/bin/env bash
# run-limited.sh — chạy một lệnh trong systemd user scope giới hạn tài nguyên.
# Dùng cho các job nặng của ops (install/build/test): tối đa 4 CPU + 6 GB RAM, swap 0.
# Deploy KHÔNG đi qua wrapper này (scripts/deploy.sh chạy nguyên nó trên box).
#
#   bin/run-limited.sh -- <lệnh> [args...]
#
set -euo pipefail

if [[ "${1:-}" == "--" ]]; then
  shift
fi
if [[ $# -eq 0 ]]; then
  echo "usage: run-limited.sh -- <command> [args...]" >&2
  exit 64
fi

if ! command -v systemd-run >/dev/null 2>&1; then
  echo "run-limited.sh: systemd-run không có — từ chối chạy không giới hạn" >&2
  exit 69
fi

# CPUQuota=400% = tối đa 4 core; MemoryMax=6G; MemorySwapMax=0 để thấy rõ hành vi OOM.
# --collect: dọn unit khi xong. --scope: chạy trực tiếp, thừa hưởng env của caller.
exec systemd-run --user --scope --collect \
  -p CPUQuota=400% \
  -p MemoryMax=6G \
  -p MemorySwapMax=0 \
  -- "$@"
