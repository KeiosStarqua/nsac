---
description: Pause the heartbeat schedule (extra names optional)
---

Run this command with the shell tool, then report the output briefly (which schedule id was paused; nothing else):

```bash
"$(git rev-parse --show-toplevel)/.agents/bot/ceo/.opencode/scripts/heartbeat-schedule.sh" off $ARGUMENTS
```

With no argument only `heartbeat` is paused; pass names to pause more (`hc-agents-update`). Do not delete schedules.
