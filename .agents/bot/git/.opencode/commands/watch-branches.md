---
description: Ensure a background shell is always watching BRANCHES.md for changes (start one if missing)
---

Run this command with the shell tool, then report the output briefly (running pid or started pid; nothing else):

```bash
"$(git rev-parse --show-toplevel)/.agents/bot/git/.opencode/scripts/watch-branches-start.sh"
```

Always run this at the start of a git-bot session and after a watcher exits, so `BRANCHES.md` is never unwatched. Do not start more than one watcher for the same file.
