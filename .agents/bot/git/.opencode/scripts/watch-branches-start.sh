#!/usr/bin/env bash
# DEPRECATED FALLBACK (Keios 2026-11-17): sentinel monitor is the primary watcher.
# Only use this when the sentinel plugin is unavailable; start via tools.sentinel_monitor otherwise.
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
