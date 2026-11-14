/**
 * SkyChatPanel — the `/` chat card, built on the hand-vendored shadcn AI Elements chat
 * (`src/shared/ai-elements/`, MIT) with a custom AI SDK transport (`features/agent/runtime/chat-transport.ts`).
 *
 * `/watch` keeps the legacy `ChatPanel` (a compact text row inside the watch face); this panel is the
 * console conversation. It is a **floating card portalled to `document.body`** (bottom-right, HUD still
 * visible behind it) over its own dismissable backdrop — full-bleed below 480px. Behaviour it owns:
 *
 *  - `useChat` state only; history comes from the existing `loadChatHistory` server function (the SDK
 *    never fetches it) and a turn streams through the SSE route `/api/chat-stream` (transport-owned):
 *    the reply lands token by token, no server function call from this component.
 *  - Reset clears the transcript client-side only. There is no server reset endpoint, so the stored
 *    transcript (`var/sky-sessions/<id>.json`) is left alone and comes back on the next hydration.
 *  - A failed turn shows the matching banner and never leaves an empty assistant bubble: an error
 *    before the first token throws (no bubble), an error mid-stream keeps the partial answer on screen
 *    with the banner above it.
 *  - `onReply` fires once per successful turn, so the HUD prompt + announcer keep working as before.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent, KeyboardEvent } from "react";
import { createPortal } from "react-dom";
import { useChat } from "@ai-sdk/react";
import { ArrowUpIcon, LoaderCircleIcon, MessageCircleDashedIcon, RotateCwIcon, XIcon } from "lucide-react";
import {
  Bubble,
  BubbleContent,
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupTextarea,
  Markdown,
  Message,
  MessageContent,
  MessageScroller,
  MessageScrollerButton,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerProvider,
  MessageScrollerViewport,
  Trace,
  TraceCollapsible,
  TraceCollapsibleContent,
  TraceCollapsibleTrigger,
  TraceIcon,
  TraceLine,
  TraceTitle,
} from "~/shared/ai-elements";
import { format, useCopy } from "~/shared/i18n";
import { firstName } from "../../astronaut";
import { loadChatHistory } from "../../agent/chat";
import { SkyChatTransport, chatErrorCode, messageText, toUIMessages } from "../../agent/runtime/chat-transport";
import type { SkyUIMessage } from "../../agent/runtime/chat-transport";

export type SkyChatPanelProps = {
  astronaut: { id: string; name: string } | null;
  onClose: () => void;
  onReply: (text: string) => void;
  /** A HUD program `show_on_hud` produced this turn (already reviewed server-side). */
  onUiProgram?: (program: string) => void;
};

// Floating card over the HUD: a dismissable backdrop below the card, card in the bottom-right corner
// above the detail overlay (z-35) and the chrome chips. Full-bleed on phones (≤480px), where the old
// full-screen shape is the only sensible one. Palette unchanged (Sky navy + cyan border).
const CHAT_BACKDROP = "fixed inset-0 z-[40] bg-[rgba(2,12,28,.35)] backdrop-blur-[2px]";

const CHAT_CARD = [
  "fixed right-4 bottom-4 z-[45] flex h-[min(620px,82dvh)] w-[min(430px,94vw)] flex-col overflow-hidden",
  "rounded-[20px] border border-[rgba(123,225,255,.35)]",
  "bg-[color-mix(in_srgb,var(--sky-bg)_96%,transparent)]",
  "shadow-[0_0_60px_rgba(75,151,244,.25)] text-foreground",
  // Tailwind v4 emits `translate` (not `transform`) for the 8px rise, so the transition lists it.
  "[transition:opacity_.18s_ease-out,translate_.18s_ease-out] motion-reduce:transition-none!",
  "max-[480px]:inset-0! max-[480px]:h-dvh max-[480px]:w-full max-[480px]:rounded-none! max-[480px]:border-0",
  "max-[480px]:[transition:none]",
].join(" ");

/** The two rAFs between mount and this state are the fade + 8px rise; skipped for reduced motion. */
const CHAT_CARD_OPEN = "translate-y-0 opacity-100";
const CHAT_CARD_ENTER = "translate-y-2 opacity-0 motion-reduce:translate-y-0 motion-reduce:opacity-100";

export function SkyChatPanel({ astronaut, onClose, onReply, onUiProgram }: SkyChatPanelProps) {
  const c = useCopy().chat;
  const label = astronaut ? format(c.label, { name: firstName(astronaut.name) }) : c.title;

  // A portal needs a DOM: render nothing until hydration has happened (same gate as the picker).
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // Entrance: two frames after mount flips the card out of the offset/faded state. One frame is not
  // enough — the browser would paint the open state straight away and the transition would never run
  // (reduced motion is exempt: the enter classes are neutralised under `motion-reduce`).
  const [entered, setEntered] = useState(false);
  useEffect(() => {
    let second = 0;
    const first = requestAnimationFrame(() => {
      second = requestAnimationFrame(() => setEntered(true));
    });
    return () => {
      cancelAnimationFrame(first);
      cancelAnimationFrame(second);
    };
  }, []);

  // Escape closes the card, as it does for the other HUD dialogs.
  useEffect(() => {
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  if (!mounted) return null;

  return createPortal(
    <>
      <div
        role="presentation"
        className={CHAT_BACKDROP}
        onClick={(event) => {
          if (event.target === event.currentTarget) onClose();
        }}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={label}
        className={`${CHAT_CARD} ${entered ? CHAT_CARD_OPEN : CHAT_CARD_ENTER}`}
      >
        {/* Keyed by crew member: `useChat` reads its transport once, so a new astronaut needs a new chat. */}
        <SkyChatThread
          key={astronaut?.id ?? "no-crew"}
          astronaut={astronaut}
          onClose={onClose}
          onReply={onReply}
          onUiProgram={onUiProgram}
        />
      </div>
    </>,
    document.body,
  );
}

function SkyChatThread({ astronaut, onClose, onReply, onUiProgram }: SkyChatPanelProps) {
  const c = useCopy().chat;
  const astronautId = astronaut?.id ?? null;
  const [draft, setDraft] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const onReplyRef = useRef(onReply);
  onReplyRef.current = onReply;
  // The transport is memoised per astronaut; a ref keeps the program callback current without
  // rebuilding the transport (and so without restarting `useChat`).
  const onUiProgramRef = useRef(onUiProgram);
  onUiProgramRef.current = onUiProgram;

  const transport = useMemo(
    () =>
      new SkyChatTransport({
        astronautId,
        onUiProgram: (program) => onUiProgramRef.current?.(program),
      }),
    [astronautId],
  );

  const { messages, sendMessage, setMessages, status, error } = useChat<SkyUIMessage>({
    transport,
    onFinish: ({ message, isAbort, isError }) => {
      if (isAbort || isError) return;
      const reply = messageText(message);
      if (reply) onReplyRef.current(reply);
    },
  });

  const busy = status === "submitted" || status === "streaming";
  const messagesRef = useRef(messages);
  messagesRef.current = messages;

  // Hydrate from the stored transcript. `useChat` does not fetch history, and the keyed remount above
  // means this runs once per crew member; a message typed before the request lands wins.
  useEffect(() => {
    if (!astronautId) return;
    let cancelled = false;
    void loadChatHistory({ data: { astronautId } })
      .then((history) => {
        if (cancelled || messagesRef.current.length > 0) return;
        const restored = toUIMessages(history.messages ?? []);
        if (restored.length > 0) setMessages(restored);
      })
      .catch(() => {
        /* no stored transcript: the thread stays empty */
      });
    return () => {
      cancelled = true;
    };
  }, [astronautId, setMessages]);

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  // Auto-resize the textarea (56px floor, 160px cap) — `field-sizing` is not available everywhere yet.
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(Math.max(el.scrollHeight, 56), 160)}px`;
  }, [draft]);

  const canSend = Boolean(astronautId) && draft.trim().length > 0 && !busy;

  const submit = useCallback(
    (event?: FormEvent<HTMLFormElement>) => {
      event?.preventDefault();
      if (!canSend) return;
      const text = draft.trim();
      setDraft("");
      void sendMessage({ text });
    },
    [canSend, draft, sendMessage],
  );

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== "Enter" || event.shiftKey || event.nativeEvent.isComposing) return;
    event.preventDefault();
    submit();
  };

  const reset = () => {
    if (busy) return;
    // Client-side only: no server reset endpoint exists, the stored transcript is untouched.
    setMessages([]);
    setDraft("");
    textareaRef.current?.focus();
  };

  const errorCode = error ? chatErrorCode(error) : null;
  const errorText =
    errorCode === "missing_key" ? c.missingKey : errorCode === "timeout" ? c.timeout : errorCode ? c.unavailable : null;
  const title = astronaut ? `${c.title} · ${firstName(astronaut.name)}` : c.title;
  const inputLabel = astronaut ? format(c.label, { name: firstName(astronaut.name) }) : c.selectFirst;

  return (
    <>
      <header className="mx-auto flex w-full max-w-3xl items-start justify-between gap-4 px-6 pt-6 pb-3">
        <div className="flex min-w-0 flex-col gap-1">
          <h2 className="truncate text-base font-medium text-foreground">{title}</h2>
          <p className="text-sm text-muted-foreground">{c.subtitle}</p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={reset}
            disabled={busy}
            aria-label={c.reset}
            title={c.reset}
            className="grid size-9 place-items-center rounded-full border border-border bg-transparent p-0 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-40"
          >
            <RotateCwIcon className="size-4" />
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label={c.close}
            title={c.close}
            className="grid size-9 place-items-center rounded-full border border-border bg-transparent p-0 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <XIcon className="size-4" />
          </button>
        </div>
      </header>

      <div className="mx-auto min-h-0 w-full max-w-3xl flex-1 px-6">
        <MessageScrollerProvider autoScroll defaultScrollPosition="end" scrollPreviousItemPeek={48}>
          {messages.length === 0 && !busy ? (
            <Empty className="h-full">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <MessageCircleDashedIcon className="size-5" />
                </EmptyMedia>
                <EmptyTitle>{c.emptyTitle}</EmptyTitle>
                <EmptyDescription>{c.emptyDescription}</EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <MessageScroller>
              <MessageScrollerViewport>
                <MessageScrollerContent aria-busy={busy} aria-live="polite" className="gap-5 py-2">
                  {messages.map((message) =>
                    message.role === "user" ? (
                      <MessageScrollerItem key={message.id} messageId={message.id} scrollAnchor>
                        <Message align="end">
                          <MessageContent>
                            <Bubble align="end" variant="muted">
                              <BubbleContent>{messageText(message)}</BubbleContent>
                            </Bubble>
                          </MessageContent>
                        </Message>
                      </MessageScrollerItem>
                    ) : (
                      <MessageScrollerItem key={message.id} messageId={message.id}>
                        <Message>
                          <MessageContent>
                            <Markdown>{messageText(message)}</Markdown>
                          </MessageContent>
                        </Message>
                      </MessageScrollerItem>
                    ),
                  )}
                  {busy ? (
                    <MessageScrollerItem messageId="sky-pending">
                      <Message>
                        <MessageContent>
                          <Trace>
                            <TraceCollapsible defaultOpen>
                              <TraceCollapsibleTrigger>
                                <TraceLine status="running">
                                  <TraceIcon>
                                    <LoaderCircleIcon className="animate-spin" />
                                  </TraceIcon>
                                  <TraceTitle>{c.thinking}</TraceTitle>
                                </TraceLine>
                              </TraceCollapsibleTrigger>
                              <TraceCollapsibleContent>{c.thinkingDetail}</TraceCollapsibleContent>
                            </TraceCollapsible>
                          </Trace>
                        </MessageContent>
                      </Message>
                    </MessageScrollerItem>
                  ) : null}
                </MessageScrollerContent>
              </MessageScrollerViewport>
              <MessageScrollerButton />
            </MessageScroller>
          )}
        </MessageScrollerProvider>
      </div>

      <div className="mx-auto w-full max-w-3xl px-6 pt-3 pb-5">
        {errorText ? (
          <div
            role="alert"
            className="mb-2 rounded-xl border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive"
          >
            {errorText}
          </div>
        ) : null}
        {astronaut ? null : <p className="mb-2 text-xs text-muted-foreground">{c.selectFirst}</p>}
        <form onSubmit={submit}>
          <InputGroup>
            <InputGroupTextarea
              ref={textareaRef}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={onKeyDown}
              placeholder={c.placeholder}
              aria-label={inputLabel}
              maxLength={500}
              rows={1}
              disabled={!astronaut}
              autoComplete="off"
              className="min-h-14"
            />
            <InputGroupAddon align="block-end" className="justify-end">
              <InputGroupButton type="submit" disabled={!canSend} aria-label={c.send} title={c.send}>
                <ArrowUpIcon className="size-4" />
              </InputGroupButton>
            </InputGroupAddon>
          </InputGroup>
        </form>
        <p className="mt-2 text-center text-[11px] text-muted-foreground">{c.footer}</p>
      </div>
    </>
  );
}
