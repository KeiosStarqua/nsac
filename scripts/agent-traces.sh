#!/usr/bin/env bash
# agent-traces.sh — đọc agent turn traces từ Sky backend local.
#
# Hits the LOCAL backend on 127.0.0.1:3200 (same host as the app; BACKEND_URL overrides,
# e.g. BACKEND_URL=http://127.0.0.1:3311 scripts/agent-traces.sh). Bạn thấy chính xác
# những gì coding agent nhìn thấy — mọi row đều là debug telemetry (HARNESSING §16),
# không phải chat history. Không có auth (demo posture, bind 127.0.0.1).
#
# Usage:
#   scripts/agent-traces.sh [limit] [astronautId] [agentId]
#   scripts/agent-traces.sh --help
#
#   limit        1..200, default 20 (backend clamps anyway)
#   astronautId  optional filter, vd. ayla-reyes
#   agentId      optional filter, vd. sky-chat | sky-hud-composer
#
# In JSON rows qua jq khi có jq, plain JSON khi không.
set -euo pipefail

usage() {
  sed -n '2,17p' "$0"
  exit 0
}

if [ "${1:-}" = "--help" ] || [ "${1:-}" = "-h" ]; then
  usage
fi

LIMIT="${1:-20}"
ASTRONAUT_ID="${2:-}"
AGENT_ID="${3:-}"
BASE="${BACKEND_URL:-http://127.0.0.1:3200}"

case "$LIMIT" in
  ''|*[!0-9]*) echo "agent-traces: limit must be a number (got '$LIMIT')" >&2; exit 2 ;;
esac
if [ "$LIMIT" -lt 1 ] || [ "$LIMIT" -gt 200 ]; then
  echo "agent-traces: limit must be 1..200 (got $LIMIT)" >&2; exit 2
fi

QUERY="limit=${LIMIT}"
[ -n "$ASTRONAUT_ID" ] && QUERY="${QUERY}&astronautId=${ASTRONAUT_ID}"
[ -n "$AGENT_ID" ] && QUERY="${QUERY}&agentId=${AGENT_ID}"

URL="${BASE%/}/api/agent-traces?${QUERY}"

if command -v jq >/dev/null 2>&1; then
  curl -fsS "$URL" | jq .
else
  curl -fsS "$URL"; echo
fi
