/** Replace `{key}` placeholders in a copy template. Unknown placeholders are left untouched. */
export function format(template: string, values: Readonly<Record<string, string>>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) => values[key] ?? match);
}
