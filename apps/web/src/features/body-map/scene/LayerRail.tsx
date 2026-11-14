import React from "react";
import { SYSTEM_LABELS } from "open-anatomy-3d";
import { LAYER_KEYS } from "../model/layers";

interface Props { layers: Record<string, boolean>; setLayers: (l: any) => void; }

export default function LayerRail({ layers, setLayers }: Props) {
  const toggle = (key: string) => {
    setLayers((prev: any) => {
      const onCount = LAYER_KEYS.filter((k) => prev[k]).length;
      if (prev[key] && onCount <= 1) return prev;
      return { ...prev, [key]: !prev[key] };
    });
  };
  return (
    <nav aria-label="Layers" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {LAYER_KEYS.map((k) => (
        <button key={k} type="button" aria-pressed={!!layers[k]} onClick={() => toggle(k)}>
          {(SYSTEM_LABELS as any)[k] ?? k}
        </button>
      ))}
    </nav>
  );
}