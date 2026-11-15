import { ATTRIBUTION } from "open-anatomy-3d";

/**
 * CC BY 4.0 credit for the Open Anatomy model, on every card that shows it. It is the library's own
 * `ATTRIBUTION` string (never retyped), clamped to three tiny lines with the full text in `title`,
 * plus the licence link. It sits outside the `#hologramButton` link — an anchor cannot nest in an
 * anchor — and re-enables the pointer so the licence link stays clickable.
 *
 * `placement` picks where the line sits inside its (positioned) parent:
 *   * `"corner"` (default) — top-right of the health card, the staged and declarative HUDs;
 *   * `"footer"` — bottom of the frame, for the narrow `/` mock console column where a corner line
 *     would sit on the figure's head.
 */
export function HoloCredit({ placement = "corner" }: { placement?: "corner" | "footer" }) {
  const layout =
    placement === "footer"
      ? "inset-x-0 bottom-0 w-full text-center"
      : "top-[2px] right-[2%] w-[50%] text-right";
  return (
    <p
      className={`pointer-events-auto absolute z-[9] m-0 ${layout} text-[9px] leading-[1.35] text-[#a6d9d4] opacity-[.62] transition-opacity duration-200 hover:opacity-100 motion-reduce:transition-none`}
    >
      <span className="line-clamp-3" title={ATTRIBUTION}>
        {ATTRIBUTION}
      </span>{" "}
      <a
        className="whitespace-nowrap text-[#c9eef3]! underline underline-offset-[2px] hover:text-[#ffffff]!"
        href="https://creativecommons.org/licenses/by/4.0/"
        target="_blank"
        rel="noreferrer"
      >
        CC BY 4.0
      </a>
    </p>
  );
}
