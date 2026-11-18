<!-- agmsg-delivery-mode: monitor -->
# agmsg Integration Rule

## Real-time inbox watcher

At session start (or the first time you run /agmsg this session), launch a
resident inbox watcher with the `sentinel_monitor` tool so incoming agmsg
messages stream into this conversation as they arrive:

- command: '/home/keios/.agents/skills/agmsg/scripts/watch.sh' "${SENTINEL_SESSION_ID:--}" /home/keios/repos/mein/nsac/.agents/bot/ops opencode
- description: agmsg inbox stream

Do not launch it more than once per session — if a watcher is already
streaming, skip this step.

### Fallback (no sentinel_monitor tool)

If the `sentinel_monitor` tool is not available, fall back to a turn-based
self-check instead: after each tool call, run
'/home/keios/.agents/skills/agmsg/scripts/check-inbox.sh' 'opencode' /home/keios/repos/mein/nsac/.agents/bot/ops
to check the agmsg inbox for unread messages.

## Terminal/pane self-awareness
Asked about your own terminal, pane, or driver — or before using arrange/peek/poke
— run '/home/keios/.agents/skills/agmsg/scripts/where.sh' first and answer from its terminal=/capabilities=
fields. Never guess from environment variables or a grep/ps command; a driver
that IS present can be wrongly reported absent that way. Per-driver detail:
'/home/keios/.agents/skills/agmsg/scripts/drivers/terminals/<terminal>/README.md' (terminal= names which).

## Teammates: placement, status, and reaching them
Placement and status for a teammate: '/home/keios/.agents/skills/agmsg/scripts/team.sh' <team> — never a
stale memory of their last known pane. Act on one with '/home/keios/.agents/skills/agmsg/scripts/peek.sh'
/ 'poke.sh' / 'arrange.sh' <team> <name> directly, not a guess: its exit code
says whether it worked and, if not, why.
