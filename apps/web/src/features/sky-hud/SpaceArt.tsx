/**
 * Motion-design layout keyframes for the SKY HUD.
 * Local stills, generated 2026-11-14 with the Cursor image tool. No network at runtime.
 * Abstract plates only — no photograph of a person and no minor.
 */
const FRAMES = [
  ["presence", "/sky/motion/presence.jpg"],
  ["attention", "/sky/motion/attention.jpg"],
  ["understanding", "/sky/motion/understanding.jpg"],
] as const;

export function SpaceArt() {
  return (
    <div className="space-art" aria-hidden="true">
      {FRAMES.map(([name, src]) => (
        <div
          key={name}
          className={`motion-frame motion-frame-${name}`}
          style={{ backgroundImage: `url("${src}")` }}
        />
      ))}
    </div>
  );
}