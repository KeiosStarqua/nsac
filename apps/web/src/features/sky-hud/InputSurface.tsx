/**
 * The organic fluid input surface — a full-width projected membrane below the orb. Purely decorative;
 * taps land on the actual Mic and hint controls. Ported verbatim from the demo SVG.
 */
export function InputSurface() {
  return (
    <div className="input-projection" aria-hidden="true">
      <svg id="surfaceSvg" viewBox="0 0 1040 200" preserveAspectRatio="none">
        <defs>
          <linearGradient id="surfaceFill" x1=".08" y1=".8" x2=".96" y2="0">
            <stop stopColor="#76eaff" stopOpacity=".04" />
            <stop offset=".25" stopColor="#42c6ed" stopOpacity=".23" />
            <stop offset=".55" stopColor="#84a9ff" stopOpacity=".15" />
            <stop offset=".82" stopColor="#c6a4ff" stopOpacity=".19" />
            <stop offset="1" stopColor="#8af8ff" stopOpacity=".05" />
          </linearGradient>
          <linearGradient id="surfaceEdge">
            <stop stopColor="#97f1ff" stopOpacity="0" />
            <stop offset=".23" stopColor="#78f1ff" stopOpacity=".8" />
            <stop offset=".57" stopColor="#aab6ff" stopOpacity=".7" />
            <stop offset=".83" stopColor="#cca8ff" stopOpacity=".8" />
            <stop offset="1" stopColor="#8efaff" stopOpacity="0" />
          </linearGradient>
          <filter id="surfaceBlur">
            <feGaussianBlur stdDeviation="12" />
          </filter>
        </defs>
        <path className="fluid-blur" d="M20 75C170 100 172 20 330 45S570 90 710 38 870 36 1012 100L1032 130Q540 205 7 125Z" fill="url(#surfaceFill)" stroke="url(#surfaceEdge)" strokeWidth="12" filter="url(#surfaceBlur)" />
        <path className="fluid-sheet" d="M20 75C170 100 172 20 330 45S570 90 710 38 870 36 1012 100L1032 130Q540 205 7 125Z" fill="url(#surfaceFill)" stroke="url(#surfaceEdge)" strokeWidth="1.6" />
        <path className="fluid-wave wave-one" d="M25 88C140 114 230 46 324 71s196 19 307-11 260-2 375 48" fill="none" stroke="url(#surfaceEdge)" strokeWidth="1.8" opacity=".75" />
        <path className="fluid-wave wave-two" d="M30 118C175 150 250 58 360 105S572 148 724 77s211-9 280 48" fill="none" stroke="#92daff" strokeWidth="1" opacity=".35" />
      </svg>
    </div>
  );
}
