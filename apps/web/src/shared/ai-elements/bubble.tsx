/**
 * Bubble — hand-vendored from shadcn/ui AI Elements (https://ui.shadcn.com/docs/ai-elements/base/bubble,
 * MIT). The registry version styles the content through `[&>[data-slot=bubble-content]]:` utilities and
 * `cva`; here the variant travels through a tiny context instead, which keeps the same public API
 * (`<Bubble variant="muted"><BubbleContent>…`) without `class-variance-authority`.
 */
import { createContext, useContext } from "react";
import type { ComponentProps } from "react";
import { cn } from "~/shared/lib/utils";

export type BubbleVariant = "default" | "secondary" | "muted" | "outline" | "ghost";

const bubbleSurface: Record<BubbleVariant, string> = {
  default: "bg-primary text-primary-foreground",
  secondary: "bg-secondary text-secondary-foreground",
  muted: "bg-muted text-foreground",
  outline: "border-border bg-background text-foreground",
  ghost: "rounded-none border-transparent bg-transparent p-0",
};

const BubbleVariantContext = createContext<BubbleVariant>("default");

export function Bubble({
  variant = "default",
  align = "start",
  className,
  ...props
}: ComponentProps<"div"> & { variant?: BubbleVariant; align?: "start" | "end" }) {
  return (
    <BubbleVariantContext.Provider value={variant}>
      <div
        data-slot="bubble"
        data-variant={variant}
        data-align={align}
        className={cn(
          "group/bubble relative flex w-fit max-w-[80%] min-w-0 flex-col gap-1",
          "data-[align=end]:self-end data-[variant=ghost]:max-w-full",
          className,
        )}
        {...props}
      />
    </BubbleVariantContext.Provider>
  );
}

export function BubbleContent({ className, ...props }: ComponentProps<"div">) {
  const variant = useContext(BubbleVariantContext);
  return (
    <div
      data-slot="bubble-content"
      className={cn(
        "w-fit max-w-full min-w-0 overflow-hidden rounded-3xl border border-transparent px-3 py-2.5 text-sm leading-relaxed [overflow-wrap:anywhere]",
        bubbleSurface[variant],
        className,
      )}
      {...props}
    />
  );
}
