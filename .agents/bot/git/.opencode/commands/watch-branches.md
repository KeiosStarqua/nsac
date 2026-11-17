---
description: Ensure the sentinel monitor is watching BRANCHES.md and the working tree (shell fallback if the sentinel plugin is unavailable)
---

Ensure the sentinel monitor is running (primary mechanism — see .agents/bot/git/AGENTS.md, section "Background watch").
Check with `tools.sentinel_list()`; if missing, recreate with `tools.sentinel_monitor` using the exact command documented there.
Only if the sentinel plugin itself is broken, use the shell fallback with the shell tool and report the pid:

```bash
"$(git rev-parse --show-toplevel)/.agents/bot/git/.opencode/scripts/watch-branches-start.sh"
```

Always run this at the start of a git-bot session and after a watcher exits, so `BRANCHES.md` and the working tree are never unwatched. Do not start a shell watcher while the sentinel monitor is alive, and vice versa (exactly one watcher).
