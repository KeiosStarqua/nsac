import { FactIdSchema, STATION_FACTS, type FactId, type StationId } from "~/shared/sky";

// Pure checks on an OpenUI Lang program. No React: the parser is passed in, so tests and the server can
// use the same rules as the browser.

/** The subset of an OpenUI `ParseResult` these rules read. */
export interface ParsedProgram {
  readonly root: unknown;
  readonly meta: {
    readonly incomplete: boolean;
    readonly unresolved: readonly string[];
    readonly errors: readonly { readonly code: string; readonly message: string }[];
  };
}

export type ParseProgram = (source: string) => ParsedProgram;

export type Review = { readonly ok: true } | { readonly ok: false; readonly reasons: readonly string[] };

/** Generated panels stay short: a crew member reads them in a few seconds. */
export const MAX_PROGRAM_CHARS = 2400;

/**
 * The model's raw reply, reduced to the OpenUI Lang program: drops `<think>` blocks and Markdown fences,
 * which small local models add even when told not to.
 */
export function extractProgram(raw: string): string {
  const withoutThinking = raw.replace(/<think>[\s\S]*?(<\/think>|$)/g, "");
  const fenced = /```[a-zA-Z-]*\s*\n([\s\S]*?)(```|$)/.exec(withoutThinking);
  return (fenced?.[1] ?? withoutThinking).trim();
}

/** Every double-quoted string literal in the program, unescaped enough to scan for digits. */
export function stringLiterals(source: string): string[] {
  return [...source.matchAll(/"((?:[^"\\]|\\.)*)"/g)].map((match) => match[1] ?? "");
}

/** True when free text carries a digit. Numbers may only reach a panel through `Fact`. */
export const hasDigit = (text: string) => /\p{Nd}/u.test(text);

interface ElementLike {
  readonly type: "element";
  readonly typeName: string;
  readonly props: Readonly<Record<string, unknown>>;
}

function isElement(value: unknown): value is ElementLike {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as { type?: unknown }).type === "element" &&
    typeof (value as { typeName?: unknown }).typeName === "string"
  );
}

/** Fact ids used anywhere in a parsed tree. */
export function collectFacts(node: unknown, found: FactId[] = []): FactId[] {
  if (Array.isArray(node)) {
    for (const child of node) collectFacts(child, found);
  } else if (isElement(node)) {
    if (node.typeName === "Fact") {
      const id = FactIdSchema.safeParse(node.props.id);
      if (id.success) found.push(id.data);
    }
    for (const value of Object.values(node.props)) collectFacts(value, found);
  }
  return found;
}

/**
 * Decides whether a finished program may replace the built-in panel. Rejected when it does not parse
 * cleanly against the catalog, writes a digit in free text, or shows a fact this station does not allow.
 */
export function reviewProgram(source: string, station: StationId, parse: ParseProgram): Review {
  const reasons: string[] = [];
  if (!source) return { ok: false, reasons: ["empty"] };
  if (source.length > MAX_PROGRAM_CHARS) reasons.push("too long");

  const parsed = parse(source);
  if (!parsed.root) reasons.push("no root");
  if (parsed.meta.incomplete) reasons.push("incomplete");
  if (parsed.meta.unresolved.length > 0) reasons.push(`unresolved: ${parsed.meta.unresolved.join(", ")}`);
  for (const error of parsed.meta.errors) reasons.push(`${error.code}: ${error.message}`);

  if (stringLiterals(source).some(hasDigit)) reasons.push("digit in free text");

  const allowed = STATION_FACTS[station];
  const extra = collectFacts(parsed.root).filter((id) => !allowed.includes(id));
  if (extra.length > 0) reasons.push(`facts not allowed here: ${[...new Set(extra)].join(", ")}`);

  return reasons.length === 0 ? { ok: true } : { ok: false, reasons };
}
