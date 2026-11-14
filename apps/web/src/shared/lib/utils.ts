/**
 * The `cn` helper the vendored shadcn-style components expect (`components.json` already points
 * `lib/utils` here). It joins class names and drops empty values.
 *
 * No `tailwind-merge`: the repo has no such dependency, so a caller's `className` is appended last
 * and wins only where it does not collide with a default utility. The vendored components therefore
 * keep their defaults non-conflicting (spacing that a caller is expected to set is left to it).
 */
export type ClassValue = string | number | null | undefined | false | ClassValue[];

export function cn(...inputs: ClassValue[]): string {
  const out: string[] = [];
  const walk = (value: ClassValue): void => {
    if (value == null || value === false || value === "") return;
    if (Array.isArray(value)) {
      for (const entry of value) walk(entry);
      return;
    }
    out.push(String(value));
  };
  for (const input of inputs) walk(input);
  return out.join(" ");
}
