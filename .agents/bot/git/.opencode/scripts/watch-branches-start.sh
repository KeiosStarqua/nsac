#!/usr/bin/env bash
# Start (if needed) exactly one background watcher for BRANCHES.md.
set -u
ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
REPO_ROOT="$ROOT"
DIR="$ROOT/.agents/bot/git"
WATCHER="$REPO_ROOT/.agents/bot/git/.opencode/plugins/watch-branches.sh"

if pgrep -f "$WATCHER" >/dev/null 2>&1; then
  echo "watcher already running: $(pgrep -f "$WATCHER" | tr '\n' ' ')"
  exit 0
fi

nohup "$WATCHER" 7200 >/dev/null 2>&1 &
echo "started watcher pid $!"
