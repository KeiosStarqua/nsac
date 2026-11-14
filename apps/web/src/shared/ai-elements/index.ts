/**
 * AI Elements, hand-vendored (MIT, adapted from shadcn/ui — https://ui.shadcn.com/docs/ai-elements).
 *
 * The registry's `npx shadcn@latest add …` output was not used as-is: it emits classes for a shadcn
 * theme (`bg-background`, `text-muted-foreground`, `border-border`, …), imports `@/lib/utils`, and
 * pulls `@shadcn/react`, `@base-ui/react` and `class-variance-authority`. Sky has its own palette,
 * no shadcn theme and no those dependencies, so the parts were reimplemented against
 * `src/shared/lib/utils` + the semantic colours bridged in `src/styles/global.css`.
 */
export {
  MessageScroller,
  MessageScrollerButton,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerProvider,
  MessageScrollerViewport,
  useMessageScroller,
} from "./message-scroller";
export type { MessageScrollerScrollPosition } from "./message-scroller";
export { Message, MessageContent, MessageGroup } from "./message";
export { Bubble, BubbleContent } from "./bubble";
export type { BubbleVariant } from "./bubble";
export { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "./empty";
export {
  Trace,
  TraceCollapsible,
  TraceCollapsibleContent,
  TraceCollapsibleTrigger,
  TraceDescription,
  TraceIcon,
  TraceLine,
  TraceTitle,
} from "./trace";
export {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupText,
  InputGroupTextarea,
} from "./input-group";
export { Markdown } from "./markdown";
