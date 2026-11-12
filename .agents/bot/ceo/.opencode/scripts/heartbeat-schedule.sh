#!/usr/bin/env bash
# Bật / tắt / xem các schedule của session OpenCode hiện tại (experimental Scheduled Tasks).
# Dùng: heartbeat-schedule.sh on|off|status [tên-schedule...]  (mặc định: heartbeat)
# Session lấy từ $OPENCODE_SESSION_ID (OpenCode đặt khi chạy lệnh), có thể truyền qua $1 nếu cần.
set -euo pipefail

ACTION="${1:-status}"
shift || true
NAMES=("$@")
[ ${#NAMES[@]} -eq 0 ] && NAMES=("heartbeat")

SESSION="${OPENCODE_SESSION_ID:-}"
if [ -z "$SESSION" ]; then
  echo "OPENCODE_SESSION_ID trống: chạy lệnh này trong một session OpenCode (hoặc export OPENCODE_SESSION_ID=ses_...)." >&2
  exit 1
fi

api_get() { opencode api get "$1" 2>/dev/null; }
api_post() { opencode api post "$1" 2>/dev/null; }

LIST_JSON="$(api_get "/api/experimental/schedule?sessionID=$SESSION")" || {
  echo "Không gọi được API schedule (serve đã chạy? experimental.schedules bật?)." >&2
  exit 1
}

rows="$(printf '%s' "$LIST_JSON" | python3 -c '
import json,sys
d=json.load(sys.stdin).get("data") or []
for x in d:
    print("\t".join([x.get("id",""), x.get("name",""), x.get("status",""), str(x.get("nextDueAt","")), str(x.get("runCount",0))]))
')"

find_ids() {
  local name="$1"
  printf '%s\n' "$rows" | awk -F'\t' -v n="$name" '$2==n {print $1}'
}

case "$ACTION" in
  status)
    echo "session: $SESSION"
    if [ -z "$rows" ]; then echo "(không có schedule nào)"; exit 0; fi
    printf '%-34s %-18s %-8s %-9s %s\n' ID NAME STATUS RUNS NEXT_DUE
    while IFS=$'\t' read -r id name status next runs; do
      [ -z "$id" ] && continue
      due="-"
      if [ -n "$next" ] && [ "$next" != "None" ]; then
        due="$(python3 -c "import datetime,sys;print(datetime.datetime.fromtimestamp(int(sys.argv[1])/1000).strftime('%H:%M:%S'))" "$next" 2>/dev/null || echo "$next")"
      fi
      printf '%-34s %-18s %-8s %-9s %s\n' "$id" "$name" "$status" "$runs" "$due"
    done <<< "$rows"
    ;;
  off|on)
    rc=0
    for name in "${NAMES[@]}"; do
      ids="$(find_ids "$name")"
      if [ -z "$ids" ]; then
        echo "✗ $name: không có schedule trong session này (tạo lại bằng cách chạy /heartbeat-bootstrap hoặc xem SCHEDULE.md)." >&2
        rc=1
        continue
      fi
      while read -r id; do
        [ -z "$id" ] && continue
        verb=pause; [ "$ACTION" = on ] && verb=resume
        api_post "/api/experimental/schedule/$id/$verb" >/dev/null \
          && echo "✓ $name ($id): $([ "$ACTION" = off ] && echo paused || echo active)" \
          || { echo "✗ $name ($id): $ACTION thất bại" >&2; rc=1; }
      done <<< "$ids"
    done
    exit $rc
    ;;
  *)
    echo "Dùng: $0 on|off|status [tên-schedule...]" >&2
    exit 2
    ;;
esac
