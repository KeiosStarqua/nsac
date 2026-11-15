// Shared class strings for the /admin operator page (layout + tabs).
// `!` marks the few utilities that must win against globals.css, whose reset is unlayered and therefore
// outranks Tailwind's utility layer: `button { font: inherit }` (font-size/weight) and
// `:focus-visible { border-radius: 4px }` (radius on any focusable control).
export const page = "min-h-screen bg-(--bg) text-(--text) font-(family-name:--font)";
export const panel = "mx-auto max-w-[1040px] px-5 pt-7 pb-12";
export const mono = "font-(family-name:--mono)";
export const muted = "text-(--muted)";
export const inputClasses =
  "w-full rounded-(--radius-sm)! border border-(--border) bg-(--surface) px-3 py-2.5 text-[14px] text-(--text)";
export const buttonClasses =
  "cursor-pointer rounded-(--radius-sm)! border-none border-(--accent-ink) bg-(--accent) px-[18px] py-2.5 text-[14px]! font-semibold! text-(--accent-ink) disabled:opacity-60";
export const dangerButtonClasses =
  "cursor-pointer rounded-(--radius-sm)! border border-(--red) bg-transparent px-[18px] py-2.5 text-[14px]! font-semibold! text-(--red) disabled:opacity-60";
export const ghostButtonClasses =
  "cursor-pointer rounded-(--radius-sm)! border border-(--border) bg-transparent px-[18px] py-2.5 text-[14px]! font-semibold! text-(--text) disabled:opacity-60";
