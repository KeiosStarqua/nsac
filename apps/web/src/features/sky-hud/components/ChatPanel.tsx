import { useEffect, useRef, useState } from "react";
import { useCopy } from "../../../shared/i18n";
import { format } from "../../../shared/i18n/format";
import { firstName } from "../../astronaut/model/astronauts";
import { sendChat, loadChatHistory } from "../../agent/chat";

// Tailwind utilities replacing hud-screen.css's `.chat-*` block plus the `.watch-screen .chat-*`
// overrides from watch-device.css. Watch-face rules use `[.watch-screen_&]` so they keep the old
// (0,2,0) specificity over the ≤480px rules.
const CHAT_PANEL = [
  "absolute bottom-[5%] left-1/2 z-[40] flex w-[min(540px,94vw)] max-h-[min(60vh,520px)] flex-col",
  "[transform:translateX(-50%)] rounded-[28px] border border-[rgba(123,225,255,.44)]",
  "bg-[rgba(8,34,66,.94)] p-[17px_22px_12px] shadow-[0_0_55px_rgba(75,151,244,.2)]",
  // Inside the watch face the panel is a full-face sheet.
  "[.watch-screen_&]:top-0 [.watch-screen_&]:right-0 [.watch-screen_&]:bottom-auto [.watch-screen_&]:left-0 [.watch-screen_&]:h-full [.watch-screen_&]:max-h-none [.watch-screen_&]:w-full [.watch-screen_&]:[transform:none]",
  "[.watch-screen_&]:rounded-none [.watch-screen_&]:border-0 [.watch-screen_&]:bg-[rgba(6,19,33,.96)]",
  "[.watch-screen_&]:pt-[calc(env(safe-area-inset-top,0px)_+_5.2cqh)] [.watch-screen_&]:pr-[calc(env(safe-area-inset-right,0px)_+_5.6cqw)] [.watch-screen_&]:pb-[calc(env(safe-area-inset-bottom,0px)_+_4cqh)] [.watch-screen_&]:pl-[calc(env(safe-area-inset-left,0px)_+_5.6cqw)]",
  // Phone (<480px): full-bleed sheet.
  "max-[480px]:top-0 max-[480px]:right-0 max-[480px]:bottom-0 max-[480px]:left-0 max-[480px]:w-screen max-[480px]:max-h-dvh max-[480px]:rounded-none max-[480px]:[transform:none]",
  "max-[480px]:pt-[env(safe-area-inset-top,0px)] max-[480px]:pr-[12px] max-[480px]:pb-[env(safe-area-inset-bottom,0px)] max-[480px]:pl-[12px]",
].join(" ");

const CHAT_CLOSE = [
  "absolute right-[14px] top-[10px] cursor-pointer rounded-[12px]! border-0 bg-transparent px-[10px] py-[4px]",
  "text-[26px]! leading-none! text-[#eaffff] hover:bg-[rgba(147,220,255,.12)] hover:text-[#8be9ff]",
  "focus-visible:outline-2! focus-visible:outline-offset-[5px]! focus-visible:outline-[#f5fcff]!",
  "[.watch-screen_&]:static [.watch-screen_&]:mx-auto [.watch-screen_&]:mt-0 [.watch-screen_&]:mb-[.6cqh] [.watch-screen_&]:block [.watch-screen_&]:rounded-full [.watch-screen_&]:px-[4cqw] [.watch-screen_&]:py-[.6cqh] [.watch-screen_&]:text-[5cqw]!",
].join(" ");

const CHAT_EYEBROW = "mb-[4px] text-[10px] tracking-[.2em] text-[#88e1f6] [.watch-screen_&]:mb-[.8cqh] [.watch-screen_&]:text-center [.watch-screen_&]:text-[1.5cqw]";

const CHAT_MESSAGES = [
  "my-[10px] flex min-h-[60px] flex-1 flex-col gap-[8px] overflow-y-auto pr-[4px]",
  "[.watch-screen_&]:min-h-0",
  "max-[480px]:min-h-0",
].join(" ");

const CHAT_EMPTY = "text-[12px] text-[#8aa9c2]";

const CHAT_MESSAGE = "max-w-[85%] rounded-[16px] px-[12px] py-[8px] text-[13px] leading-[1.45] [overflow-wrap:anywhere] [.watch-screen_&]:text-[2.05cqw]";
const CHAT_MESSAGE_USER = "self-end border border-[rgba(147,220,255,.25)] bg-[rgba(59,131,174,.35)] text-[#eaffff]";
const CHAT_MESSAGE_SKY = "self-start border border-[rgba(147,220,255,.18)] bg-[rgba(10,32,54,.85)] text-[#c0d1e2]";

const CHAT_ROLE = "mb-[2px] block text-[9px] tracking-[.18em] text-[#88e1f6]";

const CHAT_PENDING = "my-[2px] text-[12px] text-[#8be9ff]";
const CHAT_ERROR = "my-[2px] text-[12px] text-[#ffb3a7]";
const CHAT_HINT = "my-[2px] text-[12px] text-[#8aa9c2]";

const CHAT_LINE = "mb-0 mt-[10px] flex items-center gap-[9px]";

const CHAT_INPUT = [
  "h-[40px] min-w-0 flex-1 rounded-[20px]! border border-[rgba(147,220,255,.25)] bg-[rgba(10,32,54,.9)] px-[14px] py-0 text-white",
  // `button,input{font:inherit}` used to live in hud-screen.css; keep the inherited type.
  "[font:inherit]",
  // The old `.chat-line input:focus` / `input:focus-visible` rules were unlayered, so these need `!`.
  "focus:border-[rgba(139,233,255,.5)] focus:outline-1! focus:outline-[rgba(139,233,255,.6)]! focus-visible:outline-offset-[5px]!",
  "disabled:cursor-not-allowed disabled:opacity-50",
  "[.watch-screen_&]:h-[5.6cqh] [.watch-screen_&]:min-h-[40px] [.watch-screen_&]:text-[2.1cqw]",
  "max-[480px]:h-[44px] max-[480px]:min-h-[40px] max-[480px]:text-[16px]",
].join(" ");

const CHAT_SEND = [
  "cursor-pointer rounded-[18px]! border border-[rgba(147,220,255,.35)] bg-[rgba(59,131,174,.2)] px-[16px] py-[9px] text-[#eaffff]",
  "hover:bg-[rgba(59,131,174,.4)] disabled:hover:bg-[rgba(59,131,174,.2)]",
  "disabled:cursor-not-allowed disabled:opacity-50",
  "focus-visible:outline-2! focus-visible:outline-offset-[5px]! focus-visible:outline-[#f5fcff]!",
  "[.watch-screen_&]:min-h-[5cqh] [.watch-screen_&]:text-[1.9cqw]!",
  "max-[480px]:min-h-[44px]",
].join(" ");

const CHAT_FOOTER = "mt-[8px] text-center text-[10px] text-[#8aa9c2]";

type Props = { astronaut: { id: string; name: string } | null; onClose: () => void; onReply: (text: string) => void };

export function ChatPanel({ astronaut, onClose, onReply }: Props) {
  const copy = useCopy();
  const c = copy.chat;
  const [msgs, setMsgs] = useState<{ role: string; text: string }[]>([]);
  const [text, setText] = useState("");
  const [pending, setPending] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => { setMsgs([]); }, [astronaut?.id]);

  useEffect(() => {
    if (!astronaut) return;
    let cancelled = false;
    loadChatHistory({ data: { astronautId: astronaut.id } } as any).then((r: any) => {
      if (cancelled) return;
      setMsgs(r.messages ?? []);
    });
    return () => { cancelled = true; };
  }, [astronaut?.id]);

  useEffect(() => {
    inputRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [msgs.length, pending]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!astronaut || pending) return;
    const v = text.trim();
    if (!v) return;
    setMsgs((m) => [...m, { role: "user", text: v }]);
    setPending(true);
    setErr(null);
    const r: any = await sendChat({ data: { astronautId: astronaut.id, message: v } } as any);
    setPending(false);
    if (r.status === "ok") {
      setMsgs(r.messages ?? []);
      onReply(r.reply);
      setText("");
    } else if (r.status === "missing_key") setErr(c.missingKey);
    else if (r.status === "timeout") setErr(c.timeout);
    else setErr(c.unavailable);
  };

  const inputLabel = astronaut ? format(c.label, { name: firstName(astronaut.name) }) : c.selectFirst;

  return (
    <div className={CHAT_PANEL} role="dialog" aria-label="Message SKY">
      <button type="button" className={CHAT_CLOSE} onClick={onClose} aria-label={c.close}>×</button>
      <div className={CHAT_EYEBROW}>MESSAGE SKY</div>
      <div className={CHAT_MESSAGES} aria-live="polite" aria-busy={pending} ref={listRef}>
        {msgs.length === 0 && !pending ? <div className={CHAT_EMPTY}>{c.emptyHint}</div> : null}
        {msgs.map((m, i) => (
          <div key={i} className={`${CHAT_MESSAGE} ${m.role === "user" ? CHAT_MESSAGE_USER : CHAT_MESSAGE_SKY}`}>
            <span className={CHAT_ROLE}>{m.role === "user" ? c.roleYou : c.roleSky}</span>
            {m.text}
          </div>
        ))}
      </div>
      {pending && <div className={CHAT_PENDING} role="status">{c.thinking}</div>}
      {err && <div className={CHAT_ERROR} role="alert">{err}</div>}
      {!astronaut ? <div className={CHAT_HINT}>{c.selectFirst}</div> : null}
      <form className={CHAT_LINE} onSubmit={submit}>
        <input ref={inputRef} className={CHAT_INPUT} value={text} onChange={(e) => setText(e.target.value)} maxLength={500} autoComplete="off" placeholder={c.placeholder} aria-label={inputLabel} disabled={!astronaut} />
        <button type="submit" className={CHAT_SEND} disabled={pending || !astronaut}>{c.send}</button>
      </form>
      <div className={CHAT_FOOTER}>{c.footer}</div>
    </div>
  );
}
