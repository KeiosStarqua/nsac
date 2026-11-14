// herdr-tab-status — keep the herdr tab label in sync with the session's
// working state, per the CEO bot rule (Keios, 2026-11-15):
//
//   ● working   agent đang chạy / đang làm việc
//   ○ idle      xong việc, chờ Keios
//   ◆ blocked   cần Keios quyết định (chỉ set thủ công / khi session lỗi)
//
// Label kept format: "<symbol> ceo-{index}-<slug>" — the plugin only flips the
// leading symbol; "ceo-{index}-<slug>" stays untouched. If the label carries
// no leading symbol, one is prepended.
//
// Behaviour
//   - Any step start / step end with tool calls  -> ●
//   - session.idle / session.execution.succeeded -> ○
//   - session.execution.failed / interrupted / session.error -> ◆
//   - Last step of a turn without tool calls     -> ○ after a short grace
//     delay, cancelled if the agent starts another step first.
//   - Child (subagent / hc) sessions are ignored, same default as the
//     webhook plugin.
//   - A leading ◆ is never overwritten by the quiet fallback; only real
//     activity or a terminal event flips it (error -> ◆, success -> ○).
//
// Safety: this plugin never throws into the host; every failure is logged to
// ~/.local/share/opencode/herdr-tab-status.log. It does nothing unless
// HERDR_ENV=1 and HERDR_TAB_ID are set, and herdr is reachable.
//
// The herdr binary comes from HERDR_BIN_PATH (set by herdr itself) or falls
// back to "herdr" on PATH.

import { execFile } from "node:child_process"
import { appendFileSync, mkdirSync } from "node:fs"
import { homedir } from "node:os"
import { dirname, join } from "node:path"

const DEFAULTS = { graceMs: 2000 }

const TERMINAL_OK = new Set(["session.idle", "session.execution.succeeded"])
const TERMINAL_BLOCKED = new Set(["session.execution.failed", "session.execution.interrupted", "session.error"])
const STEP_END_EVENTS = new Set(["session.step.ended", "session.next.step.ended", "session.step.failed", "session.next.step.failed"])
const STEP_START_EVENTS = new Set(["session.step.started", "session.next.step.started"])
const WORKING = "●"
const IDLE = "○"
const BLOCKED = "◆"
const SYMBOLS = new Set([WORKING, IDLE, BLOCKED])


function str(value) {
  return typeof value === "string" && value.length > 0 ? value : ""
}

function logFile() {
  return join(process.env.XDG_STATE_HOME || join(homedir(), ".local", "state"), "opencode", "herdr-tab-status.log")
}

function log(level, message) {
  try {
    const path = logFile()
    mkdirSync(dirname(path), { recursive: true })
    appendFileSync(path, `${new Date().toISOString()} [${level}] ${message}\n`)
  } catch {
    // Logging must never break a turn.
  }
}

function herdrBin() {
  return str(process.env.HERDR_BIN_PATH) || "herdr"
}

function runHerdr(args, timeoutMs = 5000) {
  return new Promise((resolve, reject) => {
    execFile(herdrBin(), args, { timeout: timeoutMs, maxBuffer: 1024 * 1024 }, (error, stdout, stderr) => {
      if (error) reject(new Error(`herdr ${args[0]} ${args[1]} failed: ${error.message} ${str(stderr).slice(0, 200)}`))
      else resolve(str(stdout))
    })
  })
}

async function currentTabLabel() {
  const raw = await runHerdr(["tab", "get", process.env.HERDR_TAB_ID])
  const parsed = JSON.parse(raw)
  const label = str(parsed?.result?.tab?.label)
  if (!label) throw new Error(`herdr tab get ${process.env.HERDR_TAB_ID} returned no label`)
  return label
}

// Strip a leading state symbol (ours only) and return the rest of the label.
function labelBody(label) {
  return label.replace(/^[●○◆]\s*/, "").trim()
}

// Set the symbol on this session's herdr tab, preserving the rest of the
// label. Never overwrites a ◆ with anything except a working-state flip from
// real activity (start of a new step) — the caller decides that via `force`.
async function setTabState(symbol, force) {
  const tab = process.env.HERDR_TAB_ID
  const label = await currentTabLabel()
  const body = labelBody(label)
  if (!body) {
    log("skip", `label "${label}" has no body, not touching`)
    return "skip"
  }
  const currentSymbol = SYMBOLS.has(label.trim()[0]) ? label.trim()[0] : null
  if (currentSymbol === symbol) return "noop"
  if (currentSymbol === BLOCKED && !force) {
    log("skip", `label "${label}" is ◆ (blocked), keeping it`)
    return "skip"
  }
  await runHerdr(["tab", "rename", tab, `${symbol} ${body}`])
  log("rename", `${symbol} ${body} (was "${label}")`)
  return "renamed"
}

// --- Event → desired state --------------------------------------------------

// A session id always starts with "ses". Other events carry their own ids.
function sessionIdOf(event) {
  const payload = event?.properties ?? event?.data ?? event?.payload ?? {}
  const candidates = [payload.sessionID, payload.sessionId, payload.session_id, payload.info?.id, event?.sessionID]
  for (const candidate of candidates) {
    const value = str(candidate)
    if (value.startsWith("ses")) return value
  }
  return ""
}

// Only the root session of this pane should drive the tab. Child sessions
// (subagents, hc terminals if they inherit the env) share the same tab and
// would thrash the symbol, so they are ignored.
async function isChildSession(api, sessionID) {
  try {
    const info = await api.getSession(sessionID)
    return Boolean(info?.parentID)
  } catch {
    return false
  }
}

// Accept both transcript shapes: v1 returns { info, parts }[] and v2 returns
// flat messages with a content[] array. Normalize to { role, text, toolCalls }.
function normalizeMessage(message) {
  const info = message?.info ?? message ?? {}
  const parts = Array.isArray(info.content) ? info.content : Array.isArray(message?.parts) ? message.parts : []
  const text = parts
    .filter((part) => part?.type === "text" && typeof part.text === "string")
    .map((part) => part.text)
    .join(" ")
    .trim()
  const toolCalls = parts.filter((part) => part?.type === "tool" || part?.type === "tool-call").length
  return { role: str(info.role) || str(info.type), text, toolCalls, error: info?.error }
}

// The turn that just finished, for the STEP_END grace check.
async function readTurn(api, sessionID) {
  const raw = await api.getMessages(sessionID)
  const messages = raw.map(normalizeMessage)
  for (let index = messages.length - 1; index >= 0; index--) {
    if (messages[index].role === "assistant") return messages[index]
  }
  return undefined
}

function createScheduler() {
  const timers = new Map() // sessionID -> timeout
  const owned = new Set()

  const cancel = (sessionID) => {
    const existing = timers.get(sessionID)
    if (existing) clearTimeout(existing)
    timers.delete(sessionID)
    owned.delete(sessionID)
  }

  const armIdle = (sessionID, delay) => {
    cancel(sessionID)
    const timer = setTimeout(() => {
      timers.delete(sessionID)
      owned.delete(sessionID)
      void setTabState(IDLE, false).catch((error) => log("error", `idle flip failed: ${error?.message || error}`))
    }, delay)
    timer?.unref?.()
    timers.set(sessionID, timer)
    owned.add(sessionID)
  }

  const dispose = () => {
    for (const sessionID of owned) cancel(sessionID)
    owned.clear()
  }

  return { cancel, armIdle, dispose }
}

async function handleEvent(api, scheduler, event) {
  const type = str(event?.type)
  const sessionID = sessionIdOf(event)
  if (!sessionID) return
  if (await isChildSession(api, sessionID)) return

  if (TERMINAL_OK.has(type)) {
    scheduler.cancel(sessionID)
    await setTabState(IDLE, true).catch((error) => log("error", `idle flip failed: ${error?.message || error}`))
    return
  }
  if (TERMINAL_BLOCKED.has(type)) {
    scheduler.cancel(sessionID)
    await setTabState(BLOCKED, true).catch((error) => log("error", `blocked flip failed: ${error?.message || error}`))
    return
  }
  if (STEP_START_EVENTS.has(type) || STEP_END_EVENTS.has(type)) {
    // A step started, or a step ended with more tool calls coming: working.
    scheduler.cancel(sessionID)
    await setTabState(WORKING, true).catch((error) => log("error", `working flip failed: ${error?.message || error}`))
    if (STEP_END_EVENTS.has(type)) {
      // If this was the last step of the turn (no tool calls), flip to idle
      // after a grace window — cancelled if another step starts in between.
      const turn = await readTurn(api, sessionID).catch(() => undefined)
      if (turn && turn.toolCalls === 0) scheduler.armIdle(sessionID, DEFAULTS.graceMs)
    }
    return
  }
  // Any other event means the agent is still working; flip only if we were idle.
  await setTabState(WORKING, false).catch(() => {})
}

// The API surface this plugin needs. The v2 context exposes the session API
// directly; the v1 context only exposes an HTTP client.
function createApi(ctx, directory) {
  return {
    directory,
    async getSession(sessionID) {
      if (ctx?.session?.get) {
        const info = await ctx.session.get({ sessionID })
        return {
          parentID: str(info?.parentID),
          directory: str(info?.location?.directory) || str(info?.directory) || directory,
        }
      }
      const raw = await ctx?.client?.session?.get({ path: { id: sessionID } })
      const info = raw?.data ?? raw
      return {
        parentID: str(info?.parentID),
        directory: str(info?.location?.directory) || str(info?.directory) || directory,
      }
    },
    async getMessages(sessionID) {
      if (ctx?.session?.context) {
        const list = await ctx.session.context({ sessionID })
        return Array.isArray(list) ? list : []
      }
      const raw = await ctx?.client?.session?.messages({ path: { id: sessionID } })
      const list = Array.isArray(raw) ? raw : Array.isArray(raw?.data) ? raw.data : Array.isArray(raw?.parts) ? raw.parts : []
      return list.map((entry) => entry?.info ?? entry)
    },
  }
}

function createQueue() {
  const chains = new Map()
  return (sessionID, task) => {
    const previous = chains.get(sessionID) || Promise.resolve()
    const next = previous.then(task).catch((error) => log("error", `queue failed: ${error?.message || error}`))
    chains.set(sessionID, next)
    next.finally(() => {
      if (chains.get(sessionID) === next) chains.delete(sessionID)
    })
  }
}

function enabled() {
  return str(process.env.HERDR_ENV) === "1" && str(process.env.HERDR_TAB_ID) !== ""
}

// OpenCode v2 entrypoint.
const setup = async (ctx) => {
  const directory = str(ctx?.location?.directory)
  const api = createApi(ctx, directory)
  const scheduler = createScheduler()
  const enqueue = createQueue()
  const controller = new AbortController()

  if (!enabled()) {
    log("setup", "disabled: HERDR_ENV != 1 or HERDR_TAB_ID unset (not a herdr pane)")
    return () => {}
  }
  log("setup", `v2 setup started pid=${process.pid} tab=${process.env.HERDR_TAB_ID} directory=${directory || "-"}`)

  void (async () => {
    try {
      for await (const event of ctx.event.subscribe({ signal: controller.signal })) {
        const sessionID = sessionIdOf(event)
        if (!sessionID) continue
        enqueue(sessionID, () => handleEvent(api, scheduler, event))
      }
      log("stop", "event stream ended")
    } catch (error) {
      if (!controller.signal.aborted) log("error", `event stream failed: ${error?.message || error}`)
      else log("stop", "event stream aborted")
    }
  })()

  return () => {
    scheduler.dispose()
    controller.abort()
    log("stop", "plugin unloaded")
  }
}

// OpenCode v1 entrypoint, kept so the same file works on older servers.
const server = async (ctx) => {
  const directory = str(ctx?.directory) || str(ctx?.worktree)
  const api = createApi(ctx, directory)
  const scheduler = createScheduler()
  const enqueue = createQueue()

  if (!enabled()) {
    log("setup", "disabled: HERDR_ENV != 1 or HERDR_TAB_ID unset (not a herdr pane)")
    return { event: async () => {} }
  }
  log("setup", `v1 setup started pid=${process.pid} tab=${process.env.HERDR_TAB_ID} directory=${directory || "-"}`)

  return {
    event: async ({ event }) => {
      const sessionID = sessionIdOf(event)
      if (!sessionID) return
      enqueue(sessionID, () => handleEvent(api, scheduler, event))
    },
  }
}

export default { id: "herdr-tab-status", server, setup }
