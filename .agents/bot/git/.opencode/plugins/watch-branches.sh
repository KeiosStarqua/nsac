#!/usr/bin/env bash
# watch-branches.sh — DEPRECATED FALLBACK (Keios 2026-11-17): primary watcher is the sentinel monitor
# (tools.sentinel_monitor in .agents/bot/git/AGENTS.md, section "Background watch"). Keep this file for
# emergency use only — never run it alongside the sentinel monitor. Fallback when the sentinel plugin fails.
# block until BRANCHES.md content OR the working tree changes, or until TIMEOUT.
#
# Two signals are tracked:
#   branches  sha256 of .agents/bot/git/BRANCHES.md (ready-branch merge queue)
#   status    sha256 over: `git status --porcelain -uall` + `git diff HEAD` + stat(size,mtime) of untracked files
#
# Exit codes:
#   0  something changed  -> bot must re-read the registry and/or `git status`, then start a new watcher
#   2  timeout, no change -> still idle; start a new watcher
#
# Output on change tells WHICH signal fired, e.g.:
#   CHANGED: BRANCHES (<old> -> <new>)
#   CHANGED: TREE (<old> -> <new>)
#   CHANGED: BRANCHES+TREE (...)
#
# Known blind spots: edits inside the `data/` submodule (not hashed — submodule only shows as one status line),
# ignored files, and file renames that keep identical paths (rename with same path impossible). mtime-only touches
# DO wake the watcher (false positives are cheap; the bot re-checks before doing anything).
# usage: ./watch-branches.sh [timeout_seconds]   (default 7200)
set -u
REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
TARGET="$REPO_ROOT/.agents/bot/git"
FILE="$TARGET/BRANCHES.md"
STATE="$TARGET/.watch-state"
TIMEOUT="${1:-7200}"
INTERVAL="${WATCH_INTERVAL:-5}"

branches_sha() {
  if [ -f "$FILE" ]; then sha256sum "$FILE" | cut -d' ' -f1; else echo "missing"; fi
}

tree_sha() {
  {
    git -C "$REPO_ROOT" status --porcelain=v1 -uall 2>/dev/null
    printf '\x00'
    git -C "$REPO_ROOT" diff HEAD 2>/dev/null
    printf '\x00'
    git -C "$REPO_ROOT" ls-files -o --exclude-standard -z 2>/dev/null \
      | xargs -0 -r stat -c '%n:%s:%Y' 2>/dev/null | LC_ALL=C sort
  } | sha256sum | cut -d' ' -f1
}

fmt_state() { printf 'branches=%s\ntree=%s\n' "$1" "$2"; }

read_state() {
  local b t
  b=$(sed -n 's/^branches=//p' "$STATE" 2>/dev/null | head -1)
  t=$(sed -n 's/^tree=//p'     "$STATE" 2>/dev/null | head -1)
  if [ -z "$b" ] || [ -z "$t" ]; then
    # legacy single-sha state file: treat both as unknown, reseed
    echo "none"
  else
    echo "$b $t"
  fi
}

cur_b="$(branches_sha)"; cur_t="$(tree_sha)"
prev="$(read_state)"
if [ "$prev" = "none" ]; then
  fmt_state "$cur_b" "$cur_t" >"$STATE"
  echo "watch: armed (branches=$cur_b tree=$cur_t)"
  prev_b="$cur_b"; prev_t="$cur_t"
else
  prev_b="${prev% *}"; prev_t="${prev#* }"
fi

start="$SECONDS"
while :; do
  cur_b="$(branches_sha)"; cur_t="$(tree_sha)"
  b_diff=0; t_diff=0
  [ "$cur_b" != "$prev_b" ] && b_diff=1
  [ "$cur_t" != "$prev_t" ] && t_diff=1
  if [ "$b_diff" = 1 ] || [ "$t_diff" = 1 ]; then
    fmt_state "$cur_b" "$cur_t" >"$STATE"
    if [ "$b_diff" = 1 ] && [ "$t_diff" = 1 ]; then
      echo "CHANGED: BRANCHES+TREE (branches $prev_b -> $cur_b; tree $prev_t -> $cur_t)"
    elif [ "$b_diff" = 1 ]; then
      echo "CHANGED: BRANCHES ($prev_b -> $cur_b)"
    else
      echo "CHANGED: TREE ($prev_t -> $cur_t)"
    fi
    exit 0
  fi
  if [ $((SECONDS - start)) -ge "$TIMEOUT" ]; then
    echo "TIMEOUT: no change in ${TIMEOUT}s"
    exit 2
  fi
  sleep "$INTERVAL"
done
