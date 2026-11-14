import { appendFileSync, existsSync, mkdirSync, readFileSync } from "node:fs"
import path from "node:path"

// git-bot wake-up plugin.
//
// Why a plugin and not a background shell: a process spawned by a plugin is
// not tracked by the harness, so it cannot wake OpenCode. This plugin runs
// inside the server, polls BRANCHES.md, and when a `Status: ready` entry
// appears it submits a prompt to the latest session, which starts a real
// agent turn. The plain watcher
// (`.agents/bot/git/.opencode/plugins/watch-branches.sh`) still exists for
// sessions that prefer a tracked background shell.
//
// Loader notes (learned from .agents/bot/ceo): the plugin is registered in
// `.agents/bot/git/opencode.jsonc` with an ABSOLUTE path and needs
// `package.json` with `exports: { ".": "./index.ts" }`. Both the v2 `setup`
// and the v1 `server` entrypoint are exported so the file loads on either
// server generation.

const POLL_MS = 5_000
const LOG = path.join(
  process.env.XDG_STATE_HOME ?? path.join(process.env.HOME ?? "/tmp", ".local", "state"),
  "opencode",
  "watch-branches.log",
)

const WAKE = [
  "[watch-branches] .agents/bot/git/BRANCHES.md now has a `Status: ready` branch.",
  "Re-read the registry and run one merge round per .agents/bot/git/AGENTS.md",
  "(merge into origin/main, gates, push, deploy/tag if requested, update the entry, clear the branch/worktree),",
  "then make sure one background watcher is running again.",
].join(" ")

function log(line: string) {
  try {
    mkdirSync(path.dirname(LOG), { recursive: true })
    appendFileSync(LOG, `${new Date().toISOString()} ${line}\n`)
  } catch {
    // never throw into the host
  }
}

function locateFile(base: string | undefined): string | undefined {
  if (!base) return undefined
  const candidates = [
    path.join(base, ".agents", "bot", "git", "BRANCHES.md"),
    path.join(base, "BRANCHES.md"),
  ]
  return candidates.find((candidate) => existsSync(candidate))
}

function readyCount(text: string): number {
  return text.split("\n").filter((line) => /^-\s*Status:\s*ready\b/i.test(line.trim())).length
}

function sessionIdOf(event: unknown): string | undefined {
  const properties = (event as { properties?: Record<string, unknown> })?.properties
  if (!properties) return undefined
  const direct = properties.sessionID
  if (typeof direct === "string") return direct
  const info = properties.info as { id?: string } | undefined
  if (typeof info?.id === "string" && info.id.startsWith("ses")) return info.id
  const session = properties.session as { id?: string } | undefined
  if (typeof session?.id === "string") return session.id
  return undefined
}

type Wake = (text: string) => Promise<void>

// Watches the file and calls `wake` when a fresh `ready` entry appears.
function startWatcher(file: string, wake: Wake, signal?: AbortSignal): () => void {
  let last = readFileSync(file, "utf8")
  let busy = false
  log(`armed on ${file}`)

  const timer = setInterval(() => {
    if (busy || !existsSync(file)) return
    const now = readFileSync(file, "utf8")
    if (now === last) return
    last = now
    if (readyCount(now) === 0) {
      log("changed, no ready entry")
      return
    }
    busy = true
    void wake(WAKE)
      .catch((error) => log(`wake failed: ${String((error as Error)?.message ?? error)}`))
      .finally(() => {
        busy = false
      })
  }, POLL_MS)

  return () => {
    clearInterval(timer)
    signal?.abort()
  }
}

async function latestSession(ctx: any, directory: string): Promise<string | undefined> {
  try {
    const page = await ctx?.session?.list?.({ directory, limit: 20 })
    const list: any[] = Array.isArray(page) ? page : (page?.items ?? page?.data ?? [])
    const latest = list
      .slice()
      .sort((a, b) => (b?.time?.updated ?? 0) - (a?.time?.updated ?? 0))[0]
    return typeof latest?.id === "string" ? latest.id : undefined
  } catch (error) {
    log(`session.list failed: ${String((error as Error)?.message ?? error)}`)
    return undefined
  }
}

// v2 entrypoint.
const setup = async (ctx: any) => {
  const directory = ctx?.location?.directory ?? ctx?.directory
  const file = locateFile(directory)
  if (!file) {
    log("not a git-bot location; plugin idle")
    return () => {}
  }

  let lastSession: string | undefined
  const controller = new AbortController()
  if (ctx?.event?.subscribe) {
    void (async () => {
      try {
        for await (const event of ctx.event.subscribe({ signal: controller.signal })) {
          const id = sessionIdOf(event)
          if (id) lastSession = id
        }
      } catch {
        // stream closed
      }
    })()
  }

  const stop = startWatcher(
    file,
    async (text) => {
      const sessionID = lastSession ?? (await latestSession(ctx, directory))
      if (!sessionID) {
        log("ready entry but no session to wake")
        return
      }
      await ctx.session.prompt({ sessionID, text })
      log(`woke session ${sessionID}`)
    },
    controller,
  )

  return stop
}

// v1 entrypoint, kept so the same file loads on older servers.
const server = async (ctx: any) => {
  const directory = ctx?.directory ?? ctx?.worktree ?? ctx?.location?.directory
  const file = locateFile(directory)
  if (!file) return { event: async () => {} }

  const stop = startWatcher(file, async (text) => {
    const client = ctx?.client
    const listed = await client?.session?.list?.({ query: { directory } })
    const sessions: any[] = Array.isArray(listed?.data) ? listed.data : []
    const latest = sessions
      .slice()
      .sort((a, b) => (b?.time?.updated ?? 0) - (a?.time?.updated ?? 0))[0]
    if (!latest?.id) {
      log("ready entry but no session to wake")
      return
    }
    await client.session.prompt({
      path: { id: latest.id },
      query: { directory },
      body: { parts: [{ type: "text", text }] },
    })
    log(`woke session ${latest.id}`)
  })

  return {
    event: async () => {
      void stop
    },
  }
}

export default { id: "nsac-watch-branches", server, setup }
