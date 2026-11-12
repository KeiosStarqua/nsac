---
description: Resume the heartbeat schedule (extra names optional)
---

Run this command with the shell tool, then report the output briefly (which schedule id is active again; nothing else):

```bash
"$(git rev-parse --show-toplevel)/.agents/bot/ceo/.opencode/scripts/heartbeat-schedule.sh" on $ARGUMENTS
```

A paused schedule resumes with its same prompt and interval. If it prints that no schedule exists, the schedule was deleted: recreate it from the payload in `.agents/bot/ceo/SCHEDULE.md`. Do not create or edit schedules as part of this command unless that failure is reported.
