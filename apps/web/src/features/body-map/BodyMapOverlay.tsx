import React, { Suspense, useEffect, useRef, useState } from "react";
import { ATTRIBUTION } from "open-anatomy-3d";

const BodyScene = React.lazy(() => import("./scene/BodyScene"));

interface Props { open: boolean; onClose: () => void; }

export default function BodyMapOverlay({ open, onClose }: Props) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const prevFocus = useRef<HTMLElement | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [layers, setLayers] = useState<Record<string, boolean>>({
    skin: true, skeleton: true, muscles: true, organs: true, vessels: true, nerves: true,
  });

  useEffect(() => {
    if (!open) return;
    prevFocus.current = document.activeElement as HTMLElement;
    document.body.style.overflow = "hidden";
    setTimeout(() => dialogRef.current?.focus(), 0);
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKey);
      prevFocus.current?.focus();
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="bodymap-title" ref={dialogRef} tabIndex={-1}
      style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(0,0,0,0.85)", display: "flex", flexDirection: "column" }}>
      <header style={{ padding: 16, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h2 id="bodymap-title" style={{ color: "#cfe", margin: 0 }}>Body hologram</h2>
        <button type="button" onClick={onClose} aria-label="Close body map">Close</button>
      </header>
      <main style={{ flex: 1, position: "relative" }}>
        <Suspense fallback={<div style={{ color: "#9bb", padding: 24 }}>Loading hologram…</div>}>
          <BodyScene selected={selected} onSelect={setSelected} layers={layers} setLayers={setLayers} />
        </Suspense>
      </main>
      <footer style={{ padding: 12, color: "#9bb", fontSize: 12 }}>
        <p>{ATTRIBUTION}</p>
        <a href="https://github.com/MervinR07/open-anatomy-3d" target="_blank" rel="noreferrer">Licence (CC BY 4.0)</a>
      </footer>
    </div>
  );
}