import { useEffect, useState } from "react";
import { useLocale } from "~/shared/i18n";
import { strings } from "./strings";
import "./tokens.css";

interface Props { title?: string; body?: string[]; measurementRefs?: string[]; children?: React.ReactNode; open?: boolean; }

export function Membrane({ title, body = [], measurementRefs = [], children, open = true }: Props) {
  const locale = useLocale();
  const t = strings[locale];
  const [visible, setVisible] = useState(false);
  const reduce = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  useEffect(() => {
    if (open) {
      const id = requestAnimationFrame(() => setVisible(true));
      return () => cancelAnimationFrame(id);
    }
    setVisible(false);
    return;
  }, [open]);

  if (!open) return null;
  return (
    <div
      className="sky-living-membrane"
      style={{
        opacity: visible ? 1 : 0,
        transform: reduce ? "none" : (visible ? "translateY(0)" : "translateY(12px)"),
        transition: reduce ? "opacity 120ms" : "opacity 240ms, transform 240ms",
        padding: 16,
        borderRadius: 12,
        background: "rgba(16,40,61,0.7)",
        border: "1px solid rgba(89,232,243,0.3)",
        color: "#E8F8FF",
      }}
    >
      <h3 style={{ margin: 0, fontSize: 16 }}>{title ?? t.membraneTitle}</h3>
      {body.map((b, i) => <p key={i} style={{ margin: "8px 0 0", fontSize: 13, lineHeight: 1.5 }}>{b}</p>)}
      {measurementRefs.length > 0 && (
        <ul style={{ margin: "8px 0 0", paddingLeft: 18, fontSize: 12, opacity: 0.8 }}>
          {measurementRefs.map((r) => <li key={r}>{r}</li>)}
        </ul>
      )}
      {children}
    </div>
  );
}