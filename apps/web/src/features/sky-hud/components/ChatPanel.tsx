import { useEffect, useRef, useState } from "react";
import { sendChat, loadChatHistory } from "../../agent/chat";

type Props = { astronaut: { id: string; name: string } | null; onClose: () => void; onReply: (text: string) => void };

export function ChatPanel({ astronaut, onClose, onReply }: Props) {
  const [msgs, setMsgs] = useState<{ role: string; text: string }[]>([]);
  const [text, setText] = useState("");
  const [pending, setPending] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

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
    } else if (r.status === "missing_key") setErr("Replies are off on this deployment: no model key is configured.");
    else if (r.status === "timeout") setErr("Sky did not answer in time. Try again.");
    else setErr("Sky could not answer. Try again.");
  };

  return (
    <div className="chat-panel" role="dialog" aria-label="Message SKY">
      <button type="button" className="chat-close" onClick={onClose} aria-label="Close chat">×</button>
      <div className="chat-eyebrow">MESSAGE SKY</div>
      <div className="chat-messages" aria-live="polite">
        {msgs.length === 0 && !pending ? <div className="chat-empty">No messages yet. Say hello to Sky.</div> : null}
        {msgs.map((m, i) => (
          <div key={i} className={`chat-message${m.role === "user" ? " chat-message-user" : " chat-message-sky"}`}>
            <span className="chat-role">{m.role === "user" ? "You" : "Sky"}</span>
            {m.text}
          </div>
        ))}
      </div>
      {pending && <div className="chat-pending" role="status">Sky is thinking…</div>}
      {err && <div className="chat-error" role="alert">{err}</div>}
      {!astronaut ? <div className="chat-hint">Select an astronaut from the roster to start chatting.</div> : null}
      <form className="chat-line" onSubmit={submit}>
        <input ref={inputRef} value={text} onChange={(e) => setText(e.target.value)} maxLength={500} placeholder="Message to Sky" aria-label="Message to Sky" disabled={!astronaut} />
        <button type="submit" disabled={pending || !astronaut}>Send</button>
      </form>
      <div className="chat-footer">Demonstration only · Not medical advice</div>
    </div>
  );
}
