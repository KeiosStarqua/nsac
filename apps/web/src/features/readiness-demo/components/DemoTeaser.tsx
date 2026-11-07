import { Await, Link } from "@tanstack/react-router";
import { useCopy, useLocale } from "~/shared/i18n";
import { SOURCES } from "~/shared/sources";
import { ExternalLink, Section } from "~/shared/ui";
import type { Snapshot } from "../model/readiness";
import { Gauge } from "./Gauge";
import styles from "./DemoTeaser.module.css";

/**
 * `snapshot` is an unawaited promise from the route loader. The section shell is in the first HTML
 * chunk; the gauge streams in when the server function resolves. `null` means it failed.
 */
export function DemoTeaser({ snapshot }: { snapshot: Promise<Snapshot | null> }) {
  const copy = useCopy();
  const locale = useLocale();

  return (
    <Section id="demo" title={copy.demoTeaser.title} lead={copy.demoTeaser.lead}>
      <div className={styles.row}>
        <div className={styles.gauge}>
          <Await promise={snapshot} fallback={<div className={styles.skeleton} aria-busy="true" />}>
            {(data) =>
              data ? (
                <>
                  <Gauge
                    value={data.score}
                    severity={data.severity}
                    label={copy.demo.scoreLabel}
                    severityLabel={copy.demo.severity[data.severity]}
                    rangeLabel={copy.demo.scoreRange}
                  />
                  <p className={styles.caption}>
                    {copy.demoTeaser.snapshotLabel} · {copy.demo.dayLabel} {data.day} · {copy.demo.simulated}
                  </p>
                </>
              ) : (
                <p className={styles.caption}>{copy.demoTeaser.unavailable}</p>
              )
            }
          </Await>
        </div>
        <div className={styles.copy}>
          <p>
            {copy.demo.gravity}{" "}
            <ExternalLink href={SOURCES.marsGravity.url}>
              {copy.demo.gravitySource}
            </ExternalLink>
          </p>
          <Link to="/demo" search={{ lang: locale }} className={styles.cta}>
            {copy.demoTeaser.cta}
          </Link>
        </div>
      </div>
    </Section>
  );
}
