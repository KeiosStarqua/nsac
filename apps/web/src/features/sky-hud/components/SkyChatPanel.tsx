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
 *  - A failed turn shows the matching banner and never leaves an empty assistant bubble: an error
 *    before the first token throws (no bubble), an error mid-stream keeps the partial answer on screen
 *    with the banner above it.
 *  - `onReply` fires once per successful turn, so the HUD prompt + announcer keep working as before.
 *  - `onUseVoice` hands the turn back to the microphone: the card closes and the host starts the same
 *    capture the idle orb starts.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent, KeyboardEvent } from "react";
import { createPortal } from "react-dom";
import { useChat } from "@ai-sdk/react";
import { LoaderCircleIcon, MessageCircleDashedIcon, MessageCircleIcon, MicIcon, SendIcon, Volume2Icon, VolumeXIcon, XIcon } from "lucide-react";
import {
  Bubble,
  BubbleContent,
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
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
  /** "Use voice" pill: close the card and start the microphone (host does both). */
  onUseVoice?: () => void;
};

// Floating card over the HUD: a dismissable backdrop below the card, card in the bottom-right corner
// above the detail overlay (z-35) and the chrome chips. Full-bleed on phones (≤480px), where the old
// full-screen shape is the only sensible one. Palette unchanged (Sky navy + cyan→purple rim).
const CHAT_BACKDROP = "fixed inset-0 z-[40] bg-[rgba(2,12,28,.35)] backdrop-blur-[2px]";

const CHAT_CARD = [
  "fixed right-4 bottom-4 z-[45] flex h-[min(600px,84dvh)] w-[min(560px,94vw)] flex-col overflow-hidden",
  "rounded-[20px] border border-transparent",
  // Double background: navy fill in the padding box, the cyan→purple rim in the border box.
  "[background:linear-gradient(180deg,#0b1a34,#081427)_padding-box,linear-gradient(120deg,rgba(92,240,208,.5),rgba(179,114,255,.5))_border-box]",
  "shadow-[0_0_44px_rgba(94,240,214,.14),0_0_80px_rgba(178,112,255,.16)] text-foreground",
  // Tailwind v4 emits `translate` (not `transform`) for the 8px rise, so the transition lists it.
  "[transition:opacity_.18s_ease-out,translate_.18s_ease-out] motion-reduce:transition-none!",
  "max-[480px]:inset-0! max-[480px]:h-dvh max-[480px]:w-full max-[480px]:rounded-none! max-[480px]:border-0",
  "max-[480px]:[transition:none] max-[480px]:[background:linear-gradient(180deg,#0b1a34,#081427)_padding-box]",
].join(" ");

/** The two rAFs between mount and this state are the fade + 8px rise; skipped for reduced motion. */
const CHAT_CARD_OPEN = "translate-y-0 opacity-100";
const CHAT_CARD_ENTER = "translate-y-2 opacity-0 motion-reduce:translate-y-0 motion-reduce:opacity-100";

const CHAT_CLOSE = [
  "grid size-9 shrink-0 place-items-center rounded-full border border-[rgba(140,200,255,.18)] bg-transparent p-0",
  "text-[#9fbcd6] transition-colors hover:bg-[rgba(120,180,255,.1)] hover:text-[#eaf6ff]",
  "focus-visible:outline-2! focus-visible:outline-offset-[3px]! focus-visible:outline-[#f5fcff]!",
].join(" ");

const CHAT_TEXTAREA = [
  "min-h-[110px] w-full resize-none rounded-[18px] border border-[rgba(140,200,255,.14)] bg-[rgba(6,16,36,.55)]",
  "px-4 py-[14px] text-[17px] leading-[1.5] text-[#eaf6ff] placeholder:text-[#6f89a8]",
  "focus-visible:outline-2! focus-visible:outline-offset-[2px]! focus-visible:outline-[rgba(92,240,208,.45)]!",
  "disabled:opacity-60 max-[480px]:min-h-[96px] max-[480px]:text-[16px]",
].join(" ");

// Voice-replies toggle in the card header: same glass-pill language as the close button.
const CHAT_TTS_TOGGLE = [
  "grid size-9 shrink-0 cursor-pointer place-items-center rounded-full border border-[rgba(140,200,255,.18)] bg-transparent p-0",
  "text-[#9fbcd6] transition-colors hover:bg-[rgba(120,180,255,.1)] hover:text-[#eaf6ff]",
  "aria-pressed:border-[rgba(92,240,208,.45)] aria-pressed:text-[#8ae6c8]",
  "focus-visible:outline-2! focus-visible:outline-offset-[3px]! focus-visible:outline-[#f5fcff]!",
].join(" ");

const CHAT_USE_VOICE = [
  "inline-flex h-[44px] shrink-0 cursor-pointer items-center gap-2 rounded-full border border-[rgba(140,220,255,.22)]",
  "bg-[rgba(120,180,255,.08)] px-[18px] text-[#dceffc] transition-colors hover:bg-[rgba(120,180,255,.16)]",
  "disabled:cursor-not-allowed disabled:opacity-40",
  "focus-visible:outline-2! focus-visible:outline-offset-[3px]! focus-visible:outline-[#f5fcff]!",
].join(" ");

const CHAT_SEND = [
  "grid size-[56px] shrink-0 cursor-pointer place-items-center rounded-[15px] border-0",
  "bg-[linear-gradient(180deg,#37e0be,#1fc9a2)] text-[#07333a] shadow-[0_0_18px_rgba(55,224,190,.3)]",
  "[transition:filter_.18s] hover:brightness-[1.06]",
  "disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:brightness-100",
  "focus-visible:outline-2! focus-visible:outline-offset-[3px]! focus-visible:outline-[#f5fcff]!",
  "max-[480px]:size-[48px]",
].join(" ");

export function SkyChatPanel({ astronaut, onClose, onReply, onUiProgram, onUseVoice }: SkyChatPanelProps) {
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
          onUseVoice={onUseVoice}
        />
      </div>
    </>,
    document.body,
  );
}

function SkyChatThread({ astronaut, onClose, onReply, onUiProgram, onUseVoice }: SkyChatPanelProps) {
  const c = useCopy().chat;
  const astronautId = astronaut?.id ?? null;
  const [draft, setDraft] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const onReplyRef = useRef(onReply);
  onReplyRef.current = onReply;

  // Voice replies (TTS). One <Audio> instance for the whole card; a new reply, the toggle
  // switching off, or the card closing stops whatever is playing. Failure is silent by design:
  // the chat must never show a TTS error banner.
  const [ttsEnabled, setTtsEnabled] = useState(
    () => typeof window === "undefined" || window.localStorage.getItem("nsac.tts") !== "0",
  );
  const ttsEnabledRef = useRef(ttsEnabled);
  ttsEnabledRef.current = ttsEnabled;
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioUrlRef = useRef<string | null>(null);
  const stopAudio = useCallback(() => {
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      audio.removeAttribute("src");
    }
    audioRef.current = null;
    if (audioUrlRef.current) {
      URL.revokeObjectURL(audioUrlRef.current);
      audioUrlRef.current = null;
    }
  }, []);
  const speak = useCallback(
    async (text: string) => {
      // A missing or failing Audio implementation (SSR, old browsers) is not an error surface.
      if (typeof Audio === "undefined") return;
      stopAudio();
      try {
        const res = await fetch("/api/tts", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ text: text.slice(0, 1000) }),
        });
        if (!res.ok) {
          console.warn(`[tts] playback skipped: HTTP ${res.status}`);
          return;
        }
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const audio = new Audio(url);
        audioUrlRef.current = url;
        audioRef.current = audio;
        audio.addEventListener("ended", stopAudio, { once: true });
        await audio.play();
      } catch (error) {
        console.warn("[tts] playback skipped:", error);
        stopAudio();
      }
    },
    [stopAudio],
  );
  const speakRef = useRef(speak);
  speakRef.current = speak;
  const toggleTts = useCallback(() => {
    setTtsEnabled((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem("nsac.tts", next ? "1" : "0");
      } catch {
        // storage unavailable (private mode): the toggle still works for this session
      }
      if (!next) stopAudio();
      return next;
    });
  }, [stopAudio]);
  // The card unmounts on close and on astronaut switch — stop playback with it.
  useEffect(() => stopAudio, [stopAudio]);
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
      if (reply && ttsEnabledRef.current) void speakRef.current(reply);
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

  // Auto-resize the textarea (110px floor, 220px cap) — `field-sizing` is not available everywhere yet.
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(Math.max(el.scrollHeight, 110), 220)}px`;
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

  const errorCode = error ? chatErrorCode(error) : null;
  const errorText =
    errorCode === "missing_key" ? c.missingKey : errorCode === "timeout" ? c.timeout : errorCode ? c.unavailable : null;
  const inputLabel = astronaut ? format(c.label, { name: firstName(astronaut.name) }) : c.selectFirst;

  return (
    <>
      <header className="flex w-full items-center justify-between gap-3 px-6 pt-5 pb-3">
        <div className="flex min-w-0 items-center gap-[10px]">
          <MessageCircleIcon className="size-5 shrink-0 text-[#8ad8e8]" strokeWidth={1.6} aria-hidden="true" />
          <h2 className="truncate text-[20px] font-light leading-[1.25]! tracking-normal! text-white">{c.panelTitle}</h2>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={toggleTts}
            aria-pressed={ttsEnabled}
            aria-label={ttsEnabled ? c.voiceOn : c.voiceOff}
            title={c.voiceToggle}
            className={CHAT_TTS_TOGGLE}
          >
            {ttsEnabled ? (
              <Volume2Icon className="size-4" strokeWidth={1.7} aria-hidden="true" />
            ) : (
              <VolumeXIcon className="size-4" strokeWidth={1.7} aria-hidden="true" />
            )}
          </button>
          <button type="button" onClick={onClose} aria-label={c.close} title={c.close} className={CHAT_CLOSE}>
            <XIcon className="size-4" />
          </button>
        </div>
      </header>

      <div className="min-h-0 w-full flex-1 px-6">
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

      <div className="w-full px-6 pt-3 pb-5">
        {errorText ? (
          <div
            role="alert"
            className="mb-2 rounded-xl border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive"
          >
            {errorText}
          </div>
        ) : null}
        {astronaut ? null : <p className="mb-2 text-xs text-muted-foreground">{c.selectFirst}</p>}
        <form onSubmit={submit} className="flex flex-col">
          <textarea
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
            className={CHAT_TEXTAREA}
          />
          <div className="mt-3 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => onUseVoice?.()}
              disabled={!onUseVoice}
              className={CHAT_USE_VOICE}
              aria-label={c.useVoice}
            >
              <MicIcon className="size-[17px] shrink-0 text-[#9fd8e8]" strokeWidth={1.7} aria-hidden="true" />
              <span className="whitespace-nowrap text-[15px]">{c.useVoice}</span>
            </button>
            <span className="text-[13px] text-[#7f96b3]">{c.enterToSend}</span>
            <button type="submit" disabled={!canSend} aria-label={c.send} title={c.send} className={CHAT_SEND}>
              {busy ? (
                <LoaderCircleIcon className="size-6 animate-spin" aria-hidden="true" />
              ) : (
                <SendIcon className="size-5" fill="currentColor" aria-hidden="true" />
              )}
            </button>
          </div>
        </form>
        <p className="mt-2 text-center text-[11px] text-muted-foreground">{c.footer}</p>
      </div>
    </>
  );
}
