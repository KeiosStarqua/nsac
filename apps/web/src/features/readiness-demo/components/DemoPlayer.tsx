import { CheckCircle, CloudSlash, Warning } from "@phosphor-icons/react";
import { useEffect, useRef, useState } from "react";
import { useCopy } from "~/shared/i18n";
import { streamFastForward } from "../api/scenario.functions";
import {
  canConfirm,
  canFastForward,
  linkStateFor,
  snapshotFor,
  type ScenarioParams,
  type Snapshot,
  type Stage,
} from "../model/readiness";
import styles from "./DemoPlayer.module.css";
import { Gauge } from "./Gauge";

interface DemoPlayerProps {
  scenario: ScenarioParams;
  /** Source of truth is the URL (`?stage=`); the route owns navigation. */
  stage: Stage;
  onStageChange: (stage: Stage) => Promise<void>;
}

export function DemoPlayer({ scenario, stage, onStageChange }: DemoPlayerProps) {
  const copy = useCopy().demo;
  const [live, setLive] = useState<Snapshot | null>(null);
  const [failed, setFailed] = useState(false);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const snapshot = live ?? snapshotFor(stage, scenario);
  const linkState = linkStateFor(stage);
  const running = live !== null;

  async function fastForward() {
    if (!canFastForward(stage) || running) return;
    setFailed(false);
    try {
      for await (const next of await streamFastForward({ data: {} })) {
        if (!mounted.current) return;
        setLive(next);
      }
      if (mounted.current) await onStageChange("fastForwarded");
    } catch {
      if (mounted.current) setFailed(true);
    } finally {
      if (mounted.current) setLive(null);
    }
  }

  const events = [
    ...copy.events,
    ...(stage === "alert" ? [] : copy.afterEvents.slice(0, stage === "confirmed" ? 1 : 2)),
  ];

  return (
    <div className={styles.player}>
      <section className={styles.panel} aria-labelledby="demo-readiness">
        <div className={styles.panelHead}>
          <h2 id="demo-readiness">{copy.title}</h2>
          <ul className={styles.chips}>
            <li className={styles.chip}>
              <CloudSlash aria-hidden="true" size={16} /> {copy.offline}
            </li>
            <li className={styles.chip}>{copy.simulated}</li>
          </ul>
        </div>

        <div className={styles.gaugeWrap}>
          <Gauge
            value={snapshot.score}
            severity={snapshot.severity}
            label={copy.scoreLabel}
            severityLabel={copy.severity[snapshot.severity]}
            rangeLabel={copy.scoreRange}
          />
        </div>

        <p className={styles.day} aria-live="polite">
          {running ? `${copy.running} ${snapshot.day}` : `${copy.dayLabel} ${snapshot.day}`}
        </p>
        <p className={styles.headline}>{copy.headline[stage]}</p>

        <div className={styles.link} data-state={linkState}>
          <strong>{copy.linkTitle}</strong>
          <span aria-live="polite">{copy.link[linkState]}</span>
        </div>

        <p className={styles.note}>{copy.note}</p>
      </section>

      <div className={styles.side}>
        <section className={styles.card} aria-labelledby="demo-events">
          <h3 id="demo-events">{copy.eventsTitle}</h3>
          <ol className={styles.timeline}>
            {events.map((event) => (
              <li key={`${event.when}-${event.text}`}>
                <span className={styles.when}>{event.when}</span>
                <span>{event.text}</span>
              </li>
            ))}
          </ol>
        </section>

        <section className={styles.card} aria-labelledby="demo-action">
          <h3 id="demo-action">{copy.recommendationTitle}</h3>
          <p className={styles.action}>{copy.action}</p>
          <p className={styles.rationale}>{copy.rationale}</p>

          {stage === "alert" ? (
            <p className={styles.gate}>
              <Warning aria-hidden="true" size={18} /> {copy.needsConfirm}
            </p>
          ) : (
            <p className={styles.done}>
              <CheckCircle aria-hidden="true" size={18} weight="fill" /> {copy.confirmedLabel}
            </p>
          )}

          <div className={styles.buttons}>
            <button
              type="button"
              className={styles.primary}
              disabled={!canConfirm(stage)}
              onClick={() => void onStageChange("confirmed")}
            >
              {copy.confirm}
            </button>
            <button
              type="button"
              className={styles.secondary}
              disabled={!canFastForward(stage) || running}
              onClick={() => void fastForward()}
            >
              {copy.fastForward}
            </button>
            <button
              type="button"
              className={styles.ghost}
              disabled={stage === "alert" || running}
              onClick={() => void onStageChange("alert")}
            >
              {copy.reset}
            </button>
          </div>

          {failed ? (
            <p role="alert" className={styles.error}>
              {copy.error}
            </p>
          ) : null}

          <p className={styles.disclaimer}>{copy.disclaimer}</p>
        </section>
      </div>
    </div>
  );
}
