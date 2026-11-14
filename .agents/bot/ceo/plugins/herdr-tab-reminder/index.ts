// herdr-tab-reminder — force every agent turn in this pane to check the herdr
// tab label BEFORE doing real work, per the CEO bot rule (Keios, 2026-11-15):
//
//   "Mỗi khi agent bắt đầu một lượt chạy (hoặc nhiệm vụ của tab đổi hẳn),
//    PHẢI kiểm tra tên Tab herdr của mình có khớp với việc đang làm không —
//    không khớp thì đổi ngay, đầu lượt, trước khi làm việc khác."
//
// The herdr-tab-status plugin flips the leading ●/○/◆ symbol automatically on
// step events. This plugin covers the OTHER half of the rule: the <slug> body
// of "<symbol>:ceo-{index}-<slug>" (colon, no spaces — Keios, 2026-11-15) must
// reflect the task in progress. A symbol cannot know the slug, so this plugin
// injects a short reminder into the model's system instructions on every
// agent-loop request (the `context` hook). The model is then required — as a
// hard rule from AGENTS.md — to:
//
//   1. run `herdr tab get "$HERDR_TAB_ID"` at the start of the turn,
//   2. keep the `ceo-{index}-` prefix untouched and set a 2-4 word kebab-case
//      slug describing the work; rename via `herdr tab rename` using the
//      `<symbol>:ceo-{index}-<slug>` form if it does not match, BEFORE any
//      other task work,
//   3. set the symbol to ◆ when blocked on a Keios decision (○/● are managed
//      by herdr-tab-status on turn boundaries).
//
// Requirements noticed: only active inside a herdr pane (HERDR_ENV=1 and
// HERDR_TAB_ID set), same guard as herdr-tab-status; no herdr call is made by
// the hook itself — the agent does the checking, which is the point.
//
// Safety: never throws into the host. If the `context` hook is unavailable in
// the running server, the plugin logs once and does nothing. Failures are
// logged to ~/.local/share/opencode/herdr-tab-reminder.log.

import { appendFileSync, mkdirSync } from "node:fs"
import { homedir } from "node:os"
import { dirname, join } from "node:path"

const REMINDER = [
  "[herdr tab check — REQUIRED at the start of this turn, before any other work]",
  'Run `herdr tab get "$HERDR_TAB_ID"`. The label MUST match the task you are now doing. The label format is `<symbol>:ceo-{index}-<slug>` — NO spaces anywhere in the label:',
  "  - keep the `ceo-{index}-` prefix untouched,",
  "  - slug is 2-4 kebab-case words for the current task (no diacritics),",
  "  - symbol means state: ● = working, ○ = idle (waiting for Keios), ◆ = blocked (needs Keios decision). ●/○ are flipped automatically by the herdr-tab-status plugin; set ◆ manually only when you are actually blocked and say so in your reply.",
  'If the slug does not match this turn\'s task, rename it FIRST (colon, no space): `herdr tab rename "$HERDR_TAB_ID" "<symbol>:ceo-{index}-<slug>"`. Do not skip this because the task seems small; do not change the prefix.',
].join("\n")

function str(value) {
  return typeof value === "string" && value.length > 0 ? value : ""
}

function logFile() {
  return join(process.env.XDG_STATE_HOME || join(homedir(), ".local", "state"), "opencode", "herdr-tab-reminder.log")
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

function enabled() {
  return str(process.env.HERDR_ENV) === "1" && str(process.env.HERDR_TAB_ID) !== ""
}

// Register the `context` hook (agent loop, including tool-driven continuations):
// push the reminder into the outgoing system instructions. Not persisted to
// history; only affects this model call. Returns a dispose function.
async function registerContextHook(ctx) {
  const hookFn = ctx?.session?.hook
  if (typeof hookFn !== "function") {
    log("setup", "ctx.session.hook is not available on this server; reminder not registered")
    return null
  }
  try {
    const registration = await hookFn.call(ctx.session, "context", (event) => {
      try {
        if (!event?.system || typeof event.system.push !== "function") return
        event.system.push({ type: "text", text: REMINDER })
      } catch (error) {
        log("error", `context hook handler failed: ${error?.message || error}`)
      }
    })
    log("setup", "context hook registered")
    return registration && typeof registration.dispose === "function" ? registration : null
  } catch (error) {
    log("error", `failed to register context hook: ${error?.message || error}`)
    return null
  }
}

// OpenCode v2 entrypoint.
const setup = async (ctx) => {
  const directory = str(ctx?.location?.directory)
  if (!enabled()) {
    log("setup", "disabled: HERDR_ENV != 1 or HERDR_TAB_ID unset (not a herdr pane)")
    return () => {}
  }
  log("setup", `v2 setup started pid=${process.pid} tab=${process.env.HERDR_TAB_ID} directory=${directory || "-"}`)
  const registration = await registerContextHook(ctx)
  return () => {
    try {
      void registration?.dispose?.()
    } catch (error) {
      log("error", `dispose failed: ${error?.message || error}`)
    }
    log("stop", "plugin unloaded")
  }
}

// OpenCode v1 entrypoint, kept so the same file works on older servers.
const server = async (ctx) => {
  const directory = str(ctx?.directory) || str(ctx?.worktree)
  if (!enabled()) {
    log("setup", "disabled: HERDR_ENV != 1 or HERDR_TAB_ID unset (not a herdr pane)")
    return { event: async () => {} }
  }
  log("setup", `v1 setup started pid=${process.pid} tab=${process.env.HERDR_TAB_ID} directory=${directory || "-"}`)
  await registerContextHook(ctx)
  return { event: async () => {} }
}

export default { id: "herdr-tab-reminder", server, setup }
