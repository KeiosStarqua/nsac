import { useEffect, useRef, useState } from "react";
import { sendChat, loadChatHistory } from "../../agent/chat";
import "./ChatPanel.module.css";

type Props = { astronaut: { id: string; name: string } | null; onClose: () => void; onReply: (text: string) => void };

export function ChatPanel({ astronaut, onClose, onReply }: Props) {
  const [msgs, setMsgs] = useState<{ role: string; text: string }[]>([]);
  const [text, setText] = useState("");
  const [pending, setPending] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!astronaut) return;
    let cancelled = false;
    loadChatHistory({ data: { astronautId: astronaut.id } } as any).then((r: any) => {
      if (cancelled) return;
      setMsgs(r.messages ?? []);
    });
    return () => { cancelled = true; };
  }, [astronaut?.id]);

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
    <div className="chat-panel">
      <button onClick={onClose}>×</button>
      <div aria-live="polite" style={{ maxHeight: 180, overflow: "auto" }}>
        {msgs.map((m, i) => <div key={i}>{m.role === "user" ? "You" : "Sky"}: {m.text}</div>)}
      </div>
      {pending && <div>Sky is thinking…</div>}
      {err && <div>{err}</div>}
      <form onSubmit={submit}>
        <input value={text} onChange={(e) => setText(e.target.value)} maxLength={500} placeholder="Message to Sky" />
        <button type="submit" disabled={pending}>Send</button>
      </form>
      <div>Demonstration only · Not medical advice</div>
    </div>
  );
}