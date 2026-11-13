import { measurement } from "../model/data";
import { validateScene, type Scene, type SceneEntity } from "../model/scene";
import { strings } from "./strings";
import styles from "./SceneRenderer.module.css";
import type { Locale } from "~/shared/i18n/locale";

interface Props {
  scene: unknown;
  locale: Locale;
}

function Membrane({ entity, locale }: { entity: SceneEntity; locale: Locale }) {
  const s = strings[locale];
  return (
    <div className={styles.membrane}>
      <div className={styles.membraneTitle}>{entity.label}</div>
      {entity.detail ? <div className={styles.membraneDetail}>{entity.detail}</div> : null}
    </div>
  );
}

function FallbackPanel({ scene }: { scene: unknown }) {
  return (
    <div className={styles.fallbackPanel}>
      <h3>{strings.en.fallbackTitle}</h3>
      <pre>{JSON.stringify(scene, null, 2)}</pre>
    </div>
  );
}

export function SceneRenderer({ scene, locale }: Props) {
  const s = strings[locale];
  const gate = validateScene(scene);
  if (!gate.ok) {
    // eslint-disable-next-line no-console
    console.warn("validateScene failed", gate.reasons);
    return <FallbackPanel scene={scene} />;
  }
  const sc = gate.scene;
  const nodes = sc.entities.filter((e) => e.kind === "field");
  const membrane = sc.entities.find((e) => e.kind === "membrane");
  return (
    <div className={styles.sceneRoot}>
      <div className={styles.simulatedBadge}>{s.simulatedData}</div>
      <svg className={styles.fieldSvg} viewBox="0 0 300 300" role="img" aria-label={sc.title}>
        <circle cx="150" cy="150" r="24" className={styles.coreCircle} />
        <text x="150" y="155" textAnchor="middle" className={styles.coreLabel}>SKY</text>
        {nodes.map((n) => {
          const a = n.angle ?? 0;
          const x = 150 + 110 * Math.cos(a);
          const y = 150 + 110 * Math.sin(a);
          const m = n.measurementRef ? measurement(n.measurementRef) : undefined;
          return (
            <g key={n.id}>
              <line x1="150" y1="150" x2={x} y2={y} className={styles.filament} />
              <circle cx={x} cy={y} r="18" className={styles.fieldNode} />
              <text x={x} y={y + 4} textAnchor="middle" className={styles.fieldValue}>
                {m ? m.display : ""}
              </text>
            </g>
          );
        })}
      </svg>
      {membrane ? <Membrane entity={membrane} locale={locale} /> : null}
      <div className={styles.sceneTitle}>{sc.title}</div>
      <div className={styles.sceneSummary}>{sc.summary}</div>
      {sc.caveat ? <div className={styles.sceneCaveat}>{sc.caveat}</div> : null}
    </div>
  );
}
