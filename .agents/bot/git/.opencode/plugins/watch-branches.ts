import type { Plugin } from "@opencode-ai/plugin"
import { appendFileSync, existsSync, mkdirSync, readFileSync } from "node:fs"
import path from "node:path"

// git-bot watcher plugin.
//
// Why: a detached child process started by a plugin cannot wake OpenCode —
// only a shell started through OpenCode's own tool is tracked. This plugin
// instead watches BRANCHES.md inside the server and, when a `Status: ready`
// entry appears, submits a prompt to the most recently updated session,
// which starts a real agent turn.
//
// It also makes sure the plain watcher (`.agents/bot/git/.opencode/plugins/
// watch-branches.sh`) is running, so sessions that prefer the tracked
// background shell still get a completion notification.

const POLL_MS = 5_000
const LOG = path.join(
  process.env.XDG_STATE_HOME ?? path.join(process.env.HOME ?? "/tmp", ".local", "state"),
  "opencode",
  "watch-branches.log",
)

function log(line: string) {
  try {
    mkdirSync(path.dirname(LOG), { recursive: true })
    appendFileSync(LOG, `${new Date().toISOString()} ${line}\n`)
  } catch {
    // never throw into the host
  }
}

function locateFile(base: string): string | undefined {
  const candidates = [
    path.join(base, ".agents", "bot", "git", "BRANCHES.md"),
    path.join(base, "BRANCHES.md"),
  ]
  return candidates.find((candidate) => existsSync(candidate))
}

function readyCount(text: string): number {
  return text.split("\n").filter((line) => /^-\s*Status:\s*ready\b/i.test(line.trim())).length
}

const WAKE = [
  "[watch-branches] .agents/bot/git/BRANCHES.md now has a `Status: ready` branch.",
  "Re-read the registry and run one merge round per .agents/bot/git/AGENTS.md",
  "(merge into origin/main, gates, push, deploy/tag if requested, update entry, clear branch/worktree),",
  "then make sure one background watcher is running again.",
].join(" ")

export const WatchBranches: Plugin = async ({ client, directory, project }) => {
  const roots = [directory, project?.worktree, project?.directory].filter(Boolean) as string[]
  const file = roots.map(locateFile).find(Boolean)
  if (!file) return {}

  let last = readFileSync(file, "utf8")
  let busy = false

  log(`armed on ${file}`)

  const tick = async () => {
    if (busy || !existsSync(file)) return
    const now = readFileSync(file, "utf8")
    if (now === last) return
    last = now

    if (readyCount(now) === 0) {
      log("changed, no ready entry")
      return
    }

    busy = true
    try {
      const result = await client.session.list({ query: { directory } })
      const sessions = Array.isArray(result.data) ? result.data : []
      const latest = sessions
        .slice()
        .sort((a, b) => (b.time?.updated ?? 0) - (a.time?.updated ?? 0))[0]
      if (!latest) {
        log("ready entry but no session to wake")
        return
      }
      await client.session.prompt({
        path: { id: latest.id },
        query: { directory },
        body: { parts: [{ type: "text", text: WAKE }] },
      })
      log(`woke session ${latest.id}`)
    } catch (error) {
      log(`wake failed: ${String((error as Error)?.message ?? error)}`)
    } finally {
      busy = false
    }
  }

  const timer = setInterval(() => void tick(), POLL_MS)
  return () => clearInterval(timer)
}

export default { id: "nsac.watch-branches", server: WatchBranches }
