// The OpenUI Lang syntax block both HUD agent profiles carry. A prompt that asks for "an OpenUI Lang
// program" but never shows the grammar yields prose or nothing, and `parse()` then rejects it as
// "no root" — a silent 100% failure of the mount composer and of `show_on_hud`. One shared constant
// keeps the two profiles from drifting; the example is a complete program the HUD catalog accepts
// (same shape as `features/hud-gen/presets.ts`), so a model can copy it.
// No React, no IO: safe to import from a prompt builder and from tests.

/**
 * The grammar plus one complete, known-good program. Plain lines so a prompt can splice it in without
 * Markdown fences. The Allow-list line must sit above this block in every prompt that uses it.
 */
export const OPENUI_SYNTAX = [
  "OpenUI Lang: a program is one statement per line in the form name = Component(arg1, arg2, ...).",
  "The entry point MUST be root = Surface([...]); Surface is the only root component.",
  "Arguments are positional, in the catalog component's zod key order; an array is [a, b, ...].",
  "An argument may reference another statement's name (forward references resolve).",
  "Every component name MUST come from the Allow-list above; no other name exists.",
  "No digits in any text — numbers reach the screen only through Fact ids at render time.",
  "No fences, no commentary, no Markdown — the program only.",
  "",
  "Complete example of the accepted format (SKY HUD names — use only allow-listed names):",
  "root = Surface([header, left, center, right, footer])",
  "header = Header()",
  "left = LeftColumn([vitals])",
  "vitals = VitalsCard()",
  "center = CenterColumn([greeting, voice])",
  "greeting = GreetingStack()",
  "voice = VoiceCluster()",
  "right = RightColumn([readiness])",
  "readiness = ReadinessCard()",
  "footer = Footer()",
].join("\n");
