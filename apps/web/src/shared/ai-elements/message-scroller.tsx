/**
 * Message Scroller — hand-vendored from shadcn/ui AI Elements
 * (https://ui.shadcn.com/docs/ai-elements/base/chat, MIT) and reimplemented without the
 * `@shadcn/react` headless package, `@base-ui/react` or `class-variance-authority`: this repo
 * vendors components, not registries (see `apps/web/AGENTS.md`).
 *
 * The public API mirrors the documented one — Provider / Root / Viewport / Content / Item / Button —
 * so the chat screen reads like the doc. What it hides:
 *
 *  - `defaultScrollPosition` opens the thread once, on the first non-empty render ("end" by default,
 *    "last-anchor" for restored history that should start at the last question).
 *  - `scrollAnchor` rows are the person's turns: a newly appended one settles near the top of the
 *    viewport with `scrollPreviousItemPeek` px of the previous turn left visible, and the reply
 *    that streams in underneath follows the live edge.
 *  - `autoScroll` keeps following new content only while the reader is at the live edge; scrolling
 *    up (wheel, touch, keyboard) releases it and the jump-to-bottom button appears.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { ComponentProps, ReactNode } from "react";
import { ArrowDownIcon } from "lucide-react";
import { cn } from "~/shared/lib/utils";

export type MessageScrollerScrollPosition = "start" | "end" | "last-anchor";

type RegisteredItem = { id: string; el: HTMLElement; anchor: boolean };

type MessageScrollerContextValue = {
  attachViewport: (el: HTMLDivElement | null) => void;
  registerItem: (item: RegisteredItem) => () => void;
  scrollToEnd: (behavior?: ScrollBehavior) => void;
  scrollToStart: (behavior?: ScrollBehavior) => void;
  scrollToMessage: (messageId: string) => void;
  /** True while the viewport is at (or within `scrollEdgeThreshold` of) the live edge. */
  atEnd: boolean;
  /** True while the viewport is at (or within `scrollEdgeThreshold` of) the start. */
  atStart: boolean;
};

const MessageScrollerContext = createContext<MessageScrollerContextValue | null>(null);

export function useMessageScroller(): MessageScrollerContextValue {
  const context = useContext(MessageScrollerContext);
  if (!context) throw new Error("useMessageScroller must be used inside <MessageScrollerProvider>");
  return context;
}

/** Smooth scrolling only when the reader has not asked for reduced motion. */
function preferredBehavior(): ScrollBehavior {
  if (typeof window === "undefined") return "auto";
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
}

export function MessageScrollerProvider({
  autoScroll = false,
  defaultScrollPosition = "end",
  scrollEdgeThreshold = 8,
  scrollMargin = 0,
  scrollPreviousItemPeek = 64,
  children,
}: {
  autoScroll?: boolean;
  defaultScrollPosition?: MessageScrollerScrollPosition;
  scrollEdgeThreshold?: number;
  scrollMargin?: number;
  scrollPreviousItemPeek?: number;
  children: ReactNode;
}) {
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const [viewportEl, setViewportEl] = useState<HTMLDivElement | null>(null);
  const [atEnd, setAtEnd] = useState(true);
  const [atStart, setAtStart] = useState(true);
  const items = useRef(new Map<string, RegisteredItem>());
  /** Whether new content should keep the reader at the live edge. */
  const follow = useRef(autoScroll);
  /** The opening position, applied once on the first non-empty render. */
  const pendingDefault = useRef<MessageScrollerScrollPosition | null>(defaultScrollPosition);
  const anchorsSeen = useRef(0);

  const config = useRef({ autoScroll, scrollEdgeThreshold, scrollMargin, scrollPreviousItemPeek });
  config.current = { autoScroll, scrollEdgeThreshold, scrollMargin, scrollPreviousItemPeek };

  const measure = useCallback(() => {
    const el = viewportRef.current;
    if (!el) return;
    const threshold = config.current.scrollEdgeThreshold;
    const end = el.scrollHeight - el.scrollTop - el.clientHeight <= threshold;
    setAtEnd(end);
    setAtStart(el.scrollTop <= threshold);
    if (config.current.autoScroll) follow.current = end;
  }, []);

  const scrollToEnd = useCallback(
    (behavior: ScrollBehavior = "auto") => {
      const el = viewportRef.current;
      if (!el) return;
      el.scrollTo({ top: el.scrollHeight, behavior });
      measure();
    },
    [measure],
  );

  const scrollToStart = useCallback(
    (behavior: ScrollBehavior = "auto") => {
      const el = viewportRef.current;
      if (!el) return;
      el.scrollTo({ top: 0, behavior });
      measure();
    },
    [measure],
  );

  /** Puts an item at the top edge, optionally keeping `peek` px of the previous turn visible. */
  const scrollItemToTop = useCallback((item: RegisteredItem, peek: number) => {
    const el = viewportRef.current;
    if (!el) return;
    const delta = item.el.getBoundingClientRect().top - el.getBoundingClientRect().top;
    el.scrollTop = Math.max(0, el.scrollTop + delta - config.current.scrollMargin - peek);
  }, []);

  const applyDefaultPosition = useCallback(() => {
    const position = pendingDefault.current;
    const el = viewportRef.current;
    if (!position || !el) return;
    pendingDefault.current = null;
    if (position === "start") {
      el.scrollTop = 0;
    } else if (position === "last-anchor") {
      const anchors = [...items.current.values()].filter((item) => item.anchor);
      const last = anchors.at(-1);
      if (last) scrollItemToTop(last, config.current.scrollPreviousItemPeek);
      else el.scrollTop = el.scrollHeight;
    } else {
      el.scrollTop = el.scrollHeight;
    }
    measure();
  }, [measure, scrollItemToTop]);

  const registerItem = useCallback(
    (item: RegisteredItem) => {
      items.current.set(item.id, item);
      // Children mount before the viewport effect runs, so the opening position is applied there.
      if (pendingDefault.current === null) {
        if (item.anchor) {
          const previous = anchorsSeen.current;
          anchorsSeen.current += 1;
          if (previous > 0) {
            scrollItemToTop(item, config.current.scrollPreviousItemPeek);
            // The reply streams in under the new question: follow it.
            follow.current = true;
            measure();
          }
        } else if (follow.current) {
          scrollToEnd();
        }
      }
      return () => {
        items.current.delete(item.id);
      };
    },
    [measure, scrollItemToTop, scrollToEnd],
  );

  const scrollToMessage = useCallback(
    (messageId: string) => {
      const item = items.current.get(messageId);
      if (item) {
        scrollItemToTop(item, 0);
        measure();
      }
    },
    [measure, scrollItemToTop],
  );

  const attachViewport = useCallback((el: HTMLDivElement | null) => {
    viewportRef.current = el;
    setViewportEl(el);
  }, []);

  // First non-empty render: open at `defaultScrollPosition`, then follow content growth.
  useEffect(() => {
    if (!viewportEl) return;
    if (viewportEl.scrollHeight > 0) applyDefaultPosition();
    measure();
    const observer = new ResizeObserver(() => {
      if (follow.current) scrollToEnd();
      measure();
    });
    const content = viewportEl.firstElementChild;
    if (content) observer.observe(content);
    observer.observe(viewportEl);
    const onScroll = () => measure();
    viewportEl.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      viewportEl.removeEventListener("scroll", onScroll);
      observer.disconnect();
    };
  }, [viewportEl, applyDefaultPosition, measure, scrollToEnd]);

  const value = useMemo<MessageScrollerContextValue>(
    () => ({ attachViewport, registerItem, scrollToEnd, scrollToStart, scrollToMessage, atEnd, atStart }),
    [attachViewport, registerItem, scrollToEnd, scrollToStart, scrollToMessage, atEnd, atStart],
  );

  return <MessageScrollerContext.Provider value={value}>{children}</MessageScrollerContext.Provider>;
}

export function MessageScroller({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      data-slot="message-scroller"
      className={cn("group/message-scroller relative flex size-full min-h-0 flex-col overflow-hidden", className)}
      {...props}
    />
  );
}

export function MessageScrollerViewport({ className, ...props }: ComponentProps<"div">) {
  const { attachViewport } = useMessageScroller();
  return (
    <div
      ref={attachViewport}
      data-slot="message-scroller-viewport"
      className={cn(
        "size-full min-h-0 min-w-0 overflow-y-auto overscroll-contain [scrollbar-width:thin] [scrollbar-gutter:stable]",
        className,
      )}
      {...props}
    />
  );
}

export function MessageScrollerContent({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      data-slot="message-scroller-content"
      className={cn("flex h-max min-h-full min-w-0 flex-col", className)}
      {...props}
    />
  );
}

export function MessageScrollerItem({
  messageId,
  scrollAnchor = false,
  className,
  ...props
}: ComponentProps<"div"> & { messageId: string; scrollAnchor?: boolean }) {
  const { registerItem } = useMessageScroller();
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    return registerItem({ id: messageId, el, anchor: scrollAnchor });
  }, [registerItem, messageId, scrollAnchor]);

  return (
    <div
      ref={ref}
      data-slot="message-scroller-item"
      data-anchor={scrollAnchor}
      className={cn("min-w-0 shrink-0", className)}
      {...props}
    />
  );
}

export function MessageScrollerButton({
  direction = "end",
  className,
  children,
  ...props
}: ComponentProps<"button"> & { direction?: "start" | "end" }) {
  const { atEnd, atStart, scrollToEnd, scrollToStart } = useMessageScroller();
  const active = direction === "end" ? !atEnd : !atStart;
  return (
    <button
      type="button"
      data-slot="message-scroller-button"
      data-active={active}
      data-direction={direction}
      aria-label={direction === "end" ? "Scroll to end" : "Scroll to start"}
      onClick={() => (direction === "end" ? scrollToEnd(preferredBehavior()) : scrollToStart(preferredBehavior()))}
      className={cn(
        "absolute left-1/2 z-10 grid size-8 -translate-x-1/2 place-items-center rounded-full border border-border bg-background p-0 text-foreground shadow-lg transition-[opacity,transform] duration-200",
        "data-[active=false]:pointer-events-none data-[active=false]:opacity-0 data-[active=false]:translate-y-1",
        direction === "end" ? "bottom-3" : "top-3 data-[direction=start]:[&_svg]:rotate-180",
        className,
      )}
      {...props}
    >
      {children ?? <ArrowDownIcon className="size-4" />}
    </button>
  );
}
