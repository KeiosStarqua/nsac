import { useEffect, useRef, useState } from "react";
import { useCopy } from "../../../shared/i18n";
import { format } from "../../../shared/i18n/format";
import { firstName } from "../../astronaut/model/astronauts";
import { sendChat, loadChatHistory } from "../../agent/chat";

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
    <div className="chat-panel" role="dialog" aria-label="Message SKY">
      <button type="button" className="chat-close" onClick={onClose} aria-label={c.close}>×</button>
      <div className="chat-eyebrow">MESSAGE SKY</div>
      <div className="chat-messages" aria-live="polite" aria-busy={pending} ref={listRef}>
        {msgs.length === 0 && !pending ? <div className="chat-empty">{c.emptyHint}</div> : null}
        {msgs.map((m, i) => (
          <div key={i} className={`chat-message${m.role === "user" ? " chat-message-user" : " chat-message-sky"}`}>
            <span className="chat-role">{m.role === "user" ? c.roleYou : c.roleSky}</span>
            {m.text}
          </div>
        ))}
      </div>
      {pending && <div className="chat-pending" role="status">{c.thinking}</div>}
      {err && <div className="chat-error" role="alert">{err}</div>}
      {!astronaut ? <div className="chat-hint">{c.selectFirst}</div> : null}
      <form className="chat-line" onSubmit={submit}>
        <input ref={inputRef} value={text} onChange={(e) => setText(e.target.value)} maxLength={500} autoComplete="off" placeholder={c.placeholder} aria-label={inputLabel} disabled={!astronaut} />
        <button type="submit" disabled={pending || !astronaut}>{c.send}</button>
      </form>
      <div className="chat-footer">{c.footer}</div>
    </div>
  );
}
