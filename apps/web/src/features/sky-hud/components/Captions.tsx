export interface CaptionsProps {
  transcript?: string;
  responseText?: string;
  visible: boolean;
}

export function Captions({ transcript, responseText, visible }: CaptionsProps) {
  if (!visible) return null;
  const text = transcript || responseText || "";
  return (
    <div aria-live="polite" style={{ fontSize: 13, color: "#a8bdd0", textAlign: "center", maxWidth: 400, margin: "0 auto" }}>
      {text}
    </div>
  );
}