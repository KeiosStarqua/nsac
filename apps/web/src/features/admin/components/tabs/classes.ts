// Shared class strings for the /admin operator page (layout + tabs).
// `!` marks the few utilities that must win against globals.css, whose reset is unlayered and therefore
// outranks Tailwind's utility layer: `button { font: inherit }` (font-size/weight) and
// `:focus-visible { border-radius: 4px }` (radius on any focusable control).
export const page = "min-h-screen bg-(--bg) text-(--text) font-(family-name:--font)";
export const panel = "mx-auto w-full max-w-[1040px] px-4 sm:px-6 pt-6 pb-12";
export const mono = "font-(family-name:--mono)";
export const muted = "text-(--muted)";

// One card shell for every operator section (key panels, models, claims, speech, background).
export const sectionCard =
  "rounded-(--radius-sm) border border-(--border) bg-(--surface) p-4 sm:p-5 shadow-(--shadow-resting)";
// Section header: icon + small-caps title on the left, status pill on the right.
export const sectionHeader = "flex items-center justify-between gap-3";
export const sectionTitle =
  "flex min-w-0 items-center gap-2 text-[10px] font-medium uppercase tracking-[0.18em] text-(--text)";
export const sectionIcon = "size-4 text-(--muted)";
export const statusPill = (tone: "ok" | "mute") =>
  `inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-[9px] font-medium uppercase tracking-[0.14em] ${
    tone === "ok" ? "border-(--green) text-(--green)" : "border-(--border) text-(--muted)"
  }`;
export const statusDot = (tone: "ok" | "mute") =>
  `inline-block size-1.5 rounded-full ${tone === "ok" ? "bg-(--green)" : "bg-(--muted)"}`;

export const labelClasses = "mb-1.5 block text-[14px] text-(--muted)";
export const inputClasses =
  "w-full rounded-(--radius-sm)! border border-(--border) bg-(--surface-2) px-3 py-2.5 text-[14px] text-(--text) placeholder:text-(--muted)";
export const selectClasses = `${inputClasses} cursor-pointer`;
export const buttonClasses =
  "cursor-pointer rounded-(--radius-sm)! border-none border-(--accent-ink) bg-(--accent) px-[18px] py-2.5 text-[14px]! font-semibold! text-(--accent-ink) disabled:opacity-60 transition-[filter] hover:brightness-110";
export const dangerButtonClasses =
  "cursor-pointer rounded-(--radius-sm)! border border-(--red) bg-transparent px-[18px] py-2.5 text-[14px]! font-semibold! text-(--red) disabled:opacity-60 transition-colors hover:bg-(--red) hover:text-(--bg)";
export const ghostButtonClasses =
  "cursor-pointer rounded-(--radius-sm)! border border-(--border) bg-transparent px-[18px] py-2.5 text-[14px]! font-semibold! text-(--text) disabled:opacity-60 transition-colors hover:border-(--accent) hover:text-(--accent)";
