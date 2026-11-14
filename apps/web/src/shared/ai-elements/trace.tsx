/**
 * Trace — hand-vendored from shadcn/ui AI Elements (https://ui.shadcn.com/docs/ai-elements/base/trace,
 * MIT): a compact row that expands to show what the assistant is doing (here: the "Sky is thinking…"
 * row while a turn is in flight). The registry version uses the Base UI Collapsible; this one is a
 * plain `aria-expanded` button plus conditional content — no animation, so `prefers-reduced-motion`
 * needs no special case.
 */
import { createContext, useContext, useId, useState } from "react";
import type { ComponentProps } from "react";
import { cn } from "~/shared/lib/utils";

type TraceStatus = "running" | "error" | "pending";

export function Trace({ className, ...props }: ComponentProps<"div">) {
  return <div data-slot="trace" className={cn("flex w-full min-w-0 flex-col gap-2", className)} {...props} />;
}

export function TraceLine({ className, status, ...props }: ComponentProps<"span"> & { status?: TraceStatus }) {
  return (
    <span
      data-slot="trace-line"
      data-status={status}
      className={cn(
        "flex w-fit max-w-full min-w-0 items-center gap-2 text-sm text-muted-foreground",
        "data-[status=error]:text-destructive data-[status=pending]:opacity-60",
        className,
      )}
      {...props}
    />
  );
}

export function TraceIcon({ className, ...props }: ComponentProps<"span">) {
  return (
    <span
      data-slot="trace-icon"
      aria-hidden="true"
      className={cn("flex size-4 shrink-0 items-center justify-center [&_svg]:size-4", className)}
      {...props}
    />
  );
}

export function TraceTitle({ className, ...props }: ComponentProps<"span">) {
  return <span data-slot="trace-title" className={cn("min-w-0 truncate", className)} {...props} />;
}

export function TraceDescription({ className, ...props }: ComponentProps<"span">) {
  return (
    <span data-slot="trace-description" className={cn("shrink-0 text-muted-foreground/70 tabular-nums", className)} {...props} />
  );
}

const TraceCollapsibleContext = createContext<{ open: boolean; toggle: () => void; contentId: string } | null>(null);

function useTraceCollapsible() {
  const context = useContext(TraceCollapsibleContext);
  if (!context) throw new Error("Trace collapsible parts must be used inside <TraceCollapsible>");
  return context;
}

export function TraceCollapsible({
  className,
  open: openProp,
  defaultOpen = false,
  onOpenChange,
  children,
  ...props
}: Omit<ComponentProps<"div">, "onChange"> & {
  /** Controlled open state; omit it to let the row own the state (`defaultOpen`). */
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const [uncontrolled, setUncontrolled] = useState(defaultOpen);
  const open = openProp ?? uncontrolled;
  const contentId = useId();
  const toggle = () => {
    const next = !open;
    if (openProp === undefined) setUncontrolled(next);
    onOpenChange?.(next);
  };
  return (
    <TraceCollapsibleContext.Provider value={{ open, toggle, contentId }}>
      <div data-slot="trace-collapsible" data-open={open} className={cn("flex w-full min-w-0 flex-col", className)} {...props}>
        {children}
      </div>
    </TraceCollapsibleContext.Provider>
  );
}

export function TraceCollapsibleTrigger({ className, children, ...props }: ComponentProps<"button">) {
  const { open, toggle, contentId } = useTraceCollapsible();
  return (
    <button
      type="button"
      data-slot="trace-collapsible-trigger"
      aria-expanded={open}
      aria-controls={contentId}
      onClick={toggle}
      className={cn(
        "group/trace-collapsible-trigger flex w-fit max-w-full min-w-0 cursor-pointer appearance-none items-center gap-1 rounded-lg border-0 bg-transparent p-0 text-left text-muted-foreground transition-colors hover:text-foreground",
        className,
      )}
      {...props}
    >
      {children}
      <TraceIcon className={cn("transition-transform", open && "rotate-90")}>
        <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path d="m6 3 5 5-5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </TraceIcon>
    </button>
  );
}

export function TraceCollapsibleContent({ className, children, ...props }: ComponentProps<"div">) {
  const { open, contentId } = useTraceCollapsible();
  if (!open) return null;
  return (
    <div data-slot="trace-collapsible-content" id={contentId}>
      <div
        data-slot="trace-collapsible-content-inner"
        className={cn(
          "mt-2 mb-1 ml-2 min-w-0 border-l border-border pl-4 text-sm leading-relaxed text-muted-foreground [overflow-wrap:anywhere]",
          className,
        )}
        {...props}
      >
        {children}
      </div>
    </div>
  );
}
