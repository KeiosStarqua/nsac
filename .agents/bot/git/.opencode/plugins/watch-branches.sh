#!/usr/bin/env bash
# watch-branches.sh — block until BRANCHES.md content changes, or until TIMEOUT.
#
# Exit codes:
#   0  content changed  -> bot must re-read BRANCHES.md and start a new watcher
#   2  timeout, no change -> still idle; start a new watcher
#
# Usage: ./watch-branches.sh [timeout_seconds]   (default 7200)
set -u
REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
TARGET="$REPO_ROOT/.agents/bot/git"
FILE="$TARGET/BRANCHES.md"
STATE="$TARGET/.watch-state"
TIMEOUT="${1:-7200}"
INTERVAL="${WATCH_INTERVAL:-5}"

current() {
  if [ -f "$FILE" ]; then
    sha256sum "$FILE" | cut -d' ' -f1
  else
    echo "missing"
  fi
}

prev="$(cat "$STATE" 2>/dev/null || true)"
if [ -z "$prev" ]; then
  prev="$(current)"
  printf '%s\n' "$prev" >"$STATE"
  echo "watch: armed on $prev"
fi

start="$SECONDS"
while :; do
  now="$(current)"
  if [ "$now" != "$prev" ]; then
    printf '%s\n' "$now" >"$STATE"
    echo "CHANGED: $FILE ($prev -> $now)"
    exit 0
  fi
  if [ $((SECONDS - start)) -ge "$TIMEOUT" ]; then
    echo "TIMEOUT: no change in ${TIMEOUT}s"
    exit 2
  fi
  sleep "$INTERVAL"
done
