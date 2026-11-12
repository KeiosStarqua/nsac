---
description: Show this session's OpenCode schedules (status, runs, next due)
---

Run this command with the shell tool, then report the table briefly (call out anything not `active` and when it next fires):

```bash
"$(git rev-parse --show-toplevel)/.agents/bot/ceo/.opencode/scripts/heartbeat-schedule.sh" status
```
