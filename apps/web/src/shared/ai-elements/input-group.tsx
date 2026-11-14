/**
 * Input Group — hand-vendored from shadcn/ui AI Elements
 * (https://ui.shadcn.com/docs/ai-elements/base/input-group, MIT). Plain `<textarea>` + `<button>`
 * instead of the registry's Button/Input/Textarea wrappers, so nothing here depends on a shadcn theme
 * beyond the semantic colour names bridged in `src/styles/global.css`.
 *
 * Preflight is off in this app (see the head of `global.css`), so the textarea carries the UA resets
 * it would otherwise get from it: `[font:inherit]`, `border-0`, `bg-transparent`, `resize-none`.
 */
import type { ComponentProps } from "react";
import { cn } from "~/shared/lib/utils";

export function InputGroup({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      role="group"
      data-slot="input-group"
      className={cn(
        "relative flex w-full min-w-0 flex-col rounded-3xl border border-border bg-input/50 transition-colors",
        "focus-within:border-ring",
        className,
      )}
      {...props}
    />
  );
}

export function InputGroupTextarea({ className, ...props }: ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="input-group-control"
      className={cn(
        "w-full resize-none border-0 bg-transparent px-4 py-3 text-sm leading-relaxed text-foreground [font:inherit]",
        // `outline-none!`: global.css sets an unlayered `:focus-visible` outline, which beats the
        // layered utility — the group's `focus-within:border-ring` is the visible focus ring here.
        "outline-none! placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-60",
        className,
      )}
      {...props}
    />
  );
}

export function InputGroupAddon({
  className,
  align = "block-end",
  ...props
}: ComponentProps<"div"> & { align?: "inline-start" | "inline-end" | "block-start" | "block-end" }) {
  const alignment = {
    "inline-start": "order-first",
    "inline-end": "order-last",
    "block-start": "order-first w-full",
    "block-end": "order-last w-full",
  }[align];
  return (
    <div
      data-slot="input-group-addon"
      data-align={align}
      className={cn("flex items-center gap-2 px-2 pb-2 text-sm text-muted-foreground select-none", alignment, className)}
      {...props}
    />
  );
}

export function InputGroupButton({
  className,
  variant = "default",
  type = "button",
  ...props
}: Omit<ComponentProps<"button">, "type"> & {
  variant?: "default" | "ghost";
  type?: "button" | "submit" | "reset";
}) {
  return (
    <button
      type={type}
      data-slot="input-group-button"
      className={cn(
        "inline-flex size-8 shrink-0 items-center justify-center gap-2 rounded-full border border-transparent p-0 transition-colors",
        "disabled:pointer-events-none disabled:opacity-40",
        variant === "default" && "bg-primary text-primary-foreground hover:bg-primary/85",
        variant === "ghost" && "text-muted-foreground hover:bg-muted hover:text-foreground",
        className,
      )}
      {...props}
    />
  );
}

export function InputGroupText({ className, ...props }: ComponentProps<"span">) {
  return (
    <span
      className={cn("flex items-center gap-2 text-sm text-muted-foreground [&_svg]:pointer-events-none [&_svg]:size-4", className)}
      {...props}
    />
  );
}
