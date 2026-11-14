import { Plugin } from "@opencode-ai/plugin"
import { spawn, execSync } from "node:child_process"
import { existsSync } from "node:fs"
import path from "node:path"

// Auto-start a background watcher for .agents/bot/git/BRANCHES.md so the
// file is never left unwatched, even if an agent forgets to arm one.
// This is a safety net; the OpenCode-tracked background shell started via
// /watch-branches is what actually wakes OpenCode on a change.
export default Plugin.define({
  id: "nsac.watch-branches",
  async setup(ctx) {
    const dir = ctx.location.directory
    const watcher = path.join(dir, ".opencode", "plugins", "watch-branches.sh")
    if (!existsSync(watcher)) return

    try {
      execSync(`pgrep -f ${JSON.stringify(watcher)}`, { stdio: "ignore" })
      // already running
      return
    } catch {
      // not running
    }

    const child = spawn(watcher, ["7200"], { detached: true, stdio: "ignore" })
    child.unref()

    return () => {
      try {
        child.kill()
      } catch {
        // ignore
      }
    }
  },
})
