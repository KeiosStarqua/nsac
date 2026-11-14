/**
 * Message — hand-vendored from shadcn/ui AI Elements (https://ui.shadcn.com/docs/ai-elements/base/message,
 * MIT). Layout only: one row per turn, aligned start (Sky) or end (the person).
 */
import type { ComponentProps } from "react";
import { cn } from "~/shared/lib/utils";

export function MessageGroup({ className, ...props }: ComponentProps<"div">) {
  return <div data-slot="message-group" className={cn("flex min-w-0 flex-col gap-2", className)} {...props} />;
}

export function Message({ className, align = "start", ...props }: ComponentProps<"div"> & { align?: "start" | "end" }) {
  return (
    <div
      data-slot="message"
      data-align={align}
      className={cn(
        "group/message relative flex w-full min-w-0 gap-2 text-sm data-[align=end]:flex-row-reverse",
        className,
      )}
      {...props}
    />
  );
}

export function MessageContent({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      data-slot="message-content"
      className={cn(
        "flex w-full min-w-0 flex-col gap-2.5 [overflow-wrap:anywhere] group-data-[align=end]/message:items-end",
        className,
      )}
      {...props}
    />
  );
}
