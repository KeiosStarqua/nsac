import "./graphics.css";

export function ViewportFrameFX() {
  return (
    <div aria-hidden="true" style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 1 }}>
      <div style={{ position: "absolute", inset: 0, boxShadow: "inset 0 0 180px rgba(4,16,30,0.85), inset 0 0 60px rgba(108,236,255,0.06)" }} />
      <div
        className="sky-hud-sweep"
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "30%",
          height: "100%",
          background: "linear-gradient(90deg, transparent, rgba(108,236,255,0.06), transparent)",
          animation: "sky-sweep 40s linear infinite",
          mixBlendMode: "screen",
        }}
      />
      <style>{`@media (prefers-reduced-motion: reduce){ .sky-hud-sweep { animation: none !important; display:none; } }`}</style>
    </div>
  );
}