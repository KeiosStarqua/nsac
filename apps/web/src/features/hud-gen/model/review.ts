// Pure checks on an OpenUI Lang program for the HUD catalog. No React: the parser is injected, so
// tests and the server use the same rules as the browser. Adapted from the retired sky-guide
// `model/program.ts`; the HUD differs in the allow lists, the root component and the fact ids.
import { HUD_FACT_IDS } from "./names";

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

export type Review = { readonly ok: true; readonly program: string } | { readonly ok: false; readonly reasons: readonly string[] };

export interface ReviewOptions {
  /** The component names a program may use. */
  readonly allowList: readonly string[];
  /** Maximum program length in characters. */
  readonly maxChars?: number;
}

/** Composed HUD programs stay short: a crew member reads one at a glance. */
export const MAX_PROGRAM_CHARS = 4000;

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

// Machine tokens that legitimately contain digits and appear as string literals in programs
// (the vital "spo2"). These are identifiers, not prose — free text is still digit-free.
const MACHINE_LITERALS = new Set<string>(HUD_FACT_IDS);

/** True when free text carries a digit. Values may only reach the HUD through Fact/MetricTile ids. */
export const hasDigit = (text: string) => /\p{Nd}/u.test(text);

/** True when a literal is a machine token (a fact id) rather than prose. */
export const isMachineLiteral = (text: string) => MACHINE_LITERALS.has(text);

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
export function collectFacts(node: unknown, found: string[] = []): string[] {
  if (Array.isArray(node)) {
    for (const child of node) collectFacts(child, found);
  } else if (isElement(node)) {
    if (node.typeName === "Fact") {
      const id = node.props.id;
      if (typeof id === "string") found.push(id);
    }
    for (const value of Object.values(node.props)) collectFacts(value, found);
  }
  return found;
}

/** Component names used anywhere in a parsed tree. */
export function collectComponents(node: unknown, found: string[] = []): string[] {
  if (Array.isArray(node)) {
    for (const child of node) collectComponents(child, found);
  } else if (isElement(node)) {
    found.push(node.typeName);
    for (const value of Object.values(node.props)) collectComponents(value, found);
  }
  return found;
}

function rootTypeName(root: unknown): string | null {
  return isElement(root) ? root.typeName : null;
}

/**
 * Decides whether a finished program may replace the built-in layout. Rejected when it does not parse
 * cleanly against the catalog, writes a digit in free text, uses an unknown component, or references a
 * fact the HUD does not build. Numbers reach the HUD only through Fact/MetricTile refs.
 */
export function reviewProgram(source: string, options: ReviewOptions, parse: ParseProgram): Review {
  const maxChars = options.maxChars ?? MAX_PROGRAM_CHARS;
  if (!source) return { ok: false, reasons: ["empty"] };
  const reasons: string[] = [];
  if (source.length > maxChars) reasons.push("too long");

  const parsed = parse(source);
  if (!parsed.root) reasons.push("no root");
  if (parsed.meta.incomplete) reasons.push("incomplete");
  if (parsed.meta.unresolved.length > 0) reasons.push(`unresolved: ${parsed.meta.unresolved.join(", ")}`);
  for (const error of parsed.meta.errors) reasons.push(`${error.code}: ${error.message}`);

  if (stringLiterals(source).some((literal) => hasDigit(literal) && !isMachineLiteral(literal))) reasons.push("digit in free text");

  const known = new Set(options.allowList);
  const unknown = [...new Set(collectComponents(parsed.root))].filter((name) => !known.has(name));
  if (unknown.length > 0) reasons.push(`unknown component: ${unknown.join(", ")}`);

  const root = rootTypeName(parsed.root);
  if (root && root !== "Surface") reasons.push(`root must be Surface, got ${root}`);

  const allowedFacts = new Set<string>(HUD_FACT_IDS);
  const extra = collectFacts(parsed.root).filter((id) => !allowedFacts.has(id));
  if (extra.length > 0) reasons.push(`facts not allowed here: ${[...new Set(extra)].join(", ")}`);

  return reasons.length === 0 ? { ok: true, program: source } : { ok: false, reasons };
}
