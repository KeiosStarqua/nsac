import { useMemo } from "react";

/**
 * Original procedural space background: starfield, Earth horizon, vessel window, astronaut silhouette.
 * No images, no network. Seeded RNG so the layout is stable between renders.
 */
export function SpaceArt() {
  const svg = useMemo(() => {
    let seed = 422117;
    const seeded = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
    const stars = Array.from({ length: 235 }, () => {
      const x = 180 + seeded() * 1340;
      const y = 5 + seeded() * 625;
      const r = 0.3 + seeded() * 0.9;
      const a = 0.22 + seeded() * 0.72;
      return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r.toFixed(1)}" fill="#b9dcff" opacity="${a.toFixed(2)}"/>`;
    }).join("");
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1672 941" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <defs>
        <linearGradient id="void" x2=".7" y2="1"><stop stop-color="#030b16"/><stop offset=".43" stop-color="#071a2e"/><stop offset=".8" stop-color="#0a2445"/><stop offset="1" stop-color="#10263d"/></linearGradient>
        <radialGradient id="skyHalo"><stop stop-color="#1b5284" stop-opacity=".45"/><stop offset=".6" stop-color="#0a2245" stop-opacity=".17"/><stop offset="1" stop-color="#0a1930" stop-opacity="0"/></radialGradient>
        <linearGradient id="earthWater" x1=".05" y1="1" x2=".8" y2=".1"><stop stop-color="#11385b"/><stop offset=".28" stop-color="#154c7a"/><stop offset=".64" stop-color="#266b9b"/><stop offset=".92" stop-color="#4e94bd"/><stop offset="1" stop-color="#b6e2ff"/></linearGradient>
        <linearGradient id="earthLight" x1="0" y1="1" x2=".8" y2="0"><stop stop-color="#1a496f"/><stop offset=".6" stop-color="#286fa8"/><stop offset="1" stop-color="#abddff"/></linearGradient>
        <radialGradient id="earthSun"><stop stop-color="#fff6db"/><stop offset=".055" stop-color="#b9f4ff" stop-opacity=".95"/><stop offset=".22" stop-color="#86b9ff" stop-opacity=".27"/><stop offset="1" stop-color="#4aabfa" stop-opacity="0"/></radialGradient>
        <linearGradient id="vessel" x1="0" y1="0" x2="1" y2=".7"><stop stop-color="#050e1b"/><stop offset=".5" stop-color="#233952"/><stop offset=".8" stop-color="#0e2036"/><stop offset="1" stop-color="#071323"/></linearGradient>
        <linearGradient id="rail" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#18334f"/><stop offset=".4" stop-color="#547497"/><stop offset=".6" stop-color="#132d4b"/><stop offset="1" stop-color="#061626"/></linearGradient>
        <linearGradient id="desk" x1="0" y1="0" x2=".8" y2=".9"><stop stop-color="#071a2d"/><stop offset=".45" stop-color="#385476"/><stop offset=".78" stop-color="#0e2849"/><stop offset="1" stop-color="#04101e"/></linearGradient>
        <linearGradient id="suited" x1="0" y1="0" x2="1" y2=".8"><stop stop-color="#091622"/><stop offset=".42" stop-color="#3f5b78"/><stop offset=".72" stop-color="#9eb4c8"/><stop offset="1" stop-color="#15253c"/></linearGradient>
        <filter id="blueGlow"><feGaussianBlur stdDeviation="7"/></filter>
        <filter id="clouds"><feTurbulence type="fractalNoise" baseFrequency=".016 .033" numOctaves="4" seed="27" result="noise"/><feColorMatrix in="noise" type="matrix" values=".4 0 0 0 .10  0 .5 0 0 .27  0 0 .6 0 .45  0 0 0 1 0"/></filter>
        <filter id="subtleBlur"><feGaussianBlur stdDeviation="2.8"/></filter>
        <clipPath id="earthClip"><path d="M685 698C925 537 1229 384 1672 374V941H680Z"/></clipPath>
        <radialGradient id="portTint"><stop stop-color="#1f5181" stop-opacity=".05"/><stop offset=".75" stop-color="#0d3561" stop-opacity=".1"/><stop offset="1" stop-color="#04142b" stop-opacity=".27"/></radialGradient>
      </defs>
      <rect width="1672" height="941" fill="url(#void)"/><ellipse cx="835" cy="419" rx="1070" ry="600" fill="url(#skyHalo)"/>
      ${stars}
      <circle cx="515" cy="168" r="23" fill="#7795ad" opacity=".38"/><path d="M507 147a23 23 0 0 1 0 42 23 23 0 1 0 0-42" fill="#06152a"/>
      <g clip-path="url(#earthClip)">
        <rect x="650" y="370" width="1040" height="600" fill="url(#earthWater)"/>
        <ellipse cx="1220" cy="740" rx="570" ry="300" fill="#3e92c1" opacity=".18"/>
        <rect x="680" y="380" width="1020" height="600" filter="url(#clouds)" opacity=".2"/>
        <g fill="#bdeaff" opacity=".18" filter="url(#subtleBlur)">
          <path d="M805 645q121-55 238-64t173 3q-90 18-114 45-122-11-297 16m177 11q156-66 338-67 92 4 149 23-126-11-228 39z"/>
          <path d="M1180 482q100-30 190-16t175-14q-49 29-124 26-99 4-145 24z"/>
          <path d="M916 717q95-40 172-32t131 0q-120 43-303 32m209 45q107-27 203-10l120-8q-121 44-323 18z"/>
        </g>
        <path d="M685 698C925 537 1229 384 1672 374" fill="none" stroke="#9ce6ff" stroke-width="9" opacity=".62" filter="url(#blueGlow)"/>
        <path d="M685 698C925 537 1229 384 1672 374" fill="none" stroke="#9cdeff" stroke-width="2.7" opacity=".84"/>
      </g>
      <ellipse cx="1589" cy="392" rx="235" ry="178" fill="url(#earthSun)"/>
      <path d="M1600 1Q1750 250 1630 592" fill="none" stroke="#0a1a2b" stroke-width="100" opacity=".66"/>
      <path d="M0 0H425Q264 127 224 286 183 447 248 596L306 665 1672 653V941H0Z" fill="url(#portTint)" opacity=".56"/>
      <path d="M0 0H410Q178 151 174 340 165 528 268 645L347 671Q179 632 126 467 61 267 144 120L215 0Z" fill="url(#vessel)" opacity=".94"/>
      <path d="M0 0H95Q-23 174 0 312V0M1672 0h-100q120 181 100 342z" fill="#07111e"/>
      <path d="M2 0 100 0Q6 166 1 257" stroke="#26394e" stroke-width="26" fill="none" opacity=".83"/>
      <path d="M1651 4Q1722 192 1630 477L1599 599" stroke="#2a435c" stroke-width="49" fill="none" opacity=".62"/>
      <path d="M78 34q-82 107-74 196" fill="none" stroke="#ffcc94" stroke-width="4" filter="url(#blueGlow)" opacity=".9"/>
      <path d="M81 38q-81 103-73 189" fill="none" stroke="#ffb56c" stroke-width="2.8"/>
      <path d="M1610 103q57 116 22 187m-16 218-21 75" stroke="#ffba77" stroke-width="3" fill="none" filter="url(#blueGlow)"/>
      <path d="M1610 103q57 116 22 187m-16 218-21 75" stroke="#f8b273" stroke-width="1.6" fill="none"/>
      <path d="M258 628Q262 661 339 666H1447Q1511 675 1560 626" stroke="#a6e5ff" stroke-width="4" opacity=".55" fill="none"/>
      <path d="M0 632Q250 652 354 659L1458 668Q1560 679 1672 595V941H0Z" fill="url(#desk)"/>
      <path d="M0 732Q180 708 388 743 550 776 870 814 1247 854 1672 784V941H0Z" fill="#091a2f" opacity=".77"/>
      <path d="M2 735Q330 691 498 745T931 816Q1305 852 1670 749" fill="none" stroke="#749abd" stroke-width="1.5" opacity=".34"/>
      <path d="M1310 734Q1437 756 1566 796" stroke="#fecf94" stroke-width="2" opacity=".85"/>
      <g>
        <path d="M-55 560Q-35 509 37 501 101 497 125 567L139 941H-50Z" fill="#06101e"/>
        <path d="M-22 593Q-3 549 43 555q58 0 76 58l18 194L15 830Z" fill="#2c455e" opacity=".73"/>
        <path d="M84 613q-34-12-43-54l-6-52q0-37 30-52c32-12 57 3 62 45l-5 55-10 35 50 51-37 73-69-40Z" fill="#172638"/>
        <path d="M65 464q24-30 54-9c18 19 13 40 6 56L96 499Z" fill="#06101c"/>
        <path d="M81 506q13 7 32 3l-2 47-23 8-10-25Z" fill="#b97f64" opacity=".7"/>
        <path d="M59 567q32-18 66 8l44 48-9 67-67 25-52-70Z" fill="url(#suited)"/>
        <path d="M153 637q40 2 83 37l52 50 54 22q44 14 72 43l75 45-21 57-93-31-93-33-110-63-55-62Z" fill="url(#suited)"/>
        <path d="M141 679q33 11 64 39m2-42q20 25 35 47m-5 11q20 12 39 23" fill="none" stroke="#c7d7dc" stroke-width="7" opacity=".2"/>
        <path d="M430 807q66-43 112-12 49 28 72 66l75 46-34 49H382l-48-66q30-51 96-83Z" fill="url(#suited)"/>
        <path d="M402 822q61-11 103 39l22 52m34-76q41 8 78 74" fill="none" stroke="#c1d3e6" stroke-width="7" opacity=".2"/>
        <path d="M136 587q41 2 58 36l-24 44q-29 5-42-29Z" fill="#213f61" stroke="#859cb1" stroke-width="2"/>
        <path d="M145 596q25-1 37 24l-17 31-25-14Z" fill="#091d32" stroke="#6284a6"/>
        <path d="M22 673Q93 663 114 735V941H-50V742Q-44 677 22 673Z" fill="#061222"/>
        <path d="M-6 684Q74 684 82 773" stroke="#6b879f" opacity=".35" stroke-width="9" fill="none"/>
      </g>
      <path d="M285 663Q1064 664 1498 668" stroke="#6e9fc0" stroke-width="2" opacity=".38"/>
    </svg>`;
  }, []);
  // Static, trusted SVG artwork authored in this repo; no user input reaches it.
  return <div className="space-art" aria-hidden="true" dangerouslySetInnerHTML={{ __html: svg }} />;
}
