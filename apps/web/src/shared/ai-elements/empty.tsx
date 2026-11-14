/**
 * Empty — hand-vendored from shadcn/ui AI Elements (https://ui.shadcn.com/docs/ai-elements/base/empty,
 * MIT). `cva` dropped for a plain variant map.
 */
import type { ComponentProps } from "react";
import { cn } from "~/shared/lib/utils";

export function Empty({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      data-slot="empty"
      className={cn("flex w-full min-w-0 flex-1 flex-col items-center justify-center gap-4 p-8 text-center", className)}
      {...props}
    />
  );
}

export function EmptyHeader({ className, ...props }: ComponentProps<"div">) {
  return (
    <div data-slot="empty-header" className={cn("flex max-w-sm flex-col items-center gap-2", className)} {...props} />
  );
}

export function EmptyMedia({ className, variant = "default", ...props }: ComponentProps<"div"> & { variant?: "default" | "icon" }) {
  return (
    <div
      data-slot="empty-icon"
      data-variant={variant}
      className={cn(
        "mb-2 flex shrink-0 items-center justify-center",
        variant === "icon" && "size-10 rounded-xl bg-muted text-foreground",
        className,
      )}
      {...props}
    />
  );
}

export function EmptyTitle({ className, ...props }: ComponentProps<"div">) {
  return (
    <div data-slot="empty-title" className={cn("text-lg font-medium tracking-tight", className)} {...props} />
  );
}

export function EmptyDescription({ className, ...props }: ComponentProps<"p">) {
  return (
    <p data-slot="empty-description" className={cn("text-sm text-muted-foreground", className)} {...props} />
  );
}
