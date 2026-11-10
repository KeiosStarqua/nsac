#!/usr/bin/env python3
"""Quick CLI demo: generate → detect → readiness → draft → [Confirm] → report → queue.

Run from repo root:
  cd backend && uv run python -m nsac.demo

This is a smoke test, not the submission UI. The NiceGUI app (apps/onboard) will
wrap this pipeline into the interactive demo described in README "Demo (60 giây)".
"""

from __future__ import annotations

import sys
from pathlib import Path

from nsac.adapters.sqlite.outbox import Outbox
from nsac.api.pipeline import MissionPipeline
from nsac.contracts import utcnow
from nsac.reporting.render import render_report_html
from nsac.simulation import generate_crew_trajectories, inject_scenario, trajectory_to_readings

CREW = ["astro-1"]
MISSION_DAY = 170
DAYS_TO_LANDING = 14


def main() -> int:
    print("HKT demo: 60-second scenario (mission day 170, 14 days to Mars landing)\n")

    # Generate 180 days
    print("→ Generating 180-day synthetic crew data from OSDR spread...")
    trajs = generate_crew_trajectories(CREW, mission_days=180, seed=42)
    all_readings = []
    for traj in trajs:
        all_readings.extend(trajectory_to_readings(traj))
    print(f"  {len(all_readings)} readings for {len(CREW)} crew × 10 metrics")

    # Baseline: day 0..140, current: day 168..170
    baseline = [r for r in all_readings if (r.ts - all_readings[0].ts).days < 140]
    current = [r for r in all_readings if 168 <= (r.ts - all_readings[0].ts).days <= MISSION_DAY]
    # Inject sleep drop after solar storm (demo scenario)
    current = inject_scenario(current, "astro-1", "sleep_hours", spike_day=169, spike_magnitude=-2.5)
    print(f"  Baseline: {len(baseline)} readings, current window: {len(current)}")

    # Pipeline
    pipeline = MissionPipeline(mission_day=MISSION_DAY)
    print(f"\n→ Detecting deviations (day {MISSION_DAY})...")
    deviations = pipeline.evaluate(baseline, current)
    print(f"  {len(deviations)} deviations; {len([d for d in deviations if d.severity != 'green'])} non-green")

    print("\n→ Calculating readiness score...")
    # Illustrative values from the demo script (README)
    score = pipeline.score(cardio=62, musculoskeletal=58, exercise_adherence=45)
    print(f"  Readiness: {score.score}/100 ({'yellow' if 50 <= score.score < 75 else 'red' if score.score < 50 else 'green'})")
    for c in score.components:
        print(f"    {c.name}: {c.value:.1f} × {c.weight} → {c.source_url[:60]}...")

    print("\n→ Drafting recommendation...")
    draft = pipeline.draft()
    if draft:
        print(f"  Action: {draft.action}")
        print(f"  Dose: {draft.dose}")
        print(f"  Rationale: {draft.rationale}")
        print(f"  Checklist: {draft.checklist_ref.doc} p.{draft.checklist_ref.page}")
        confirm = input("\n  [Confirm] y/N? ").strip().lower()
        if confirm == "y":
            taken = pipeline.confirm()
            print(f"  ✓ Confirmed: {taken.action} at {taken.confirmed_at.strftime('%H:%M UTC')}")
        else:
            pipeline.reject()
            print("  ✗ Rejected by astronaut")
    else:
        print("  No action drafted (green state)")

    print("\n→ Generating ground report...")
    report = pipeline.report(summary=f"Day {MISSION_DAY} check-in: readiness {score.score:.1f}/100")
    html = render_report_html(report)
    out_path = Path("var") / f"report_day{MISSION_DAY}.html"
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(html, encoding="utf-8")
    print(f"  Saved: {out_path}")

    print(f"\n→ Queueing for Earth (delay: 20 min)...")
    outbox = Outbox(db_path="var/outbox.db")
    row_id = pipeline.queue(report, outbox)
    print(f"  Outbox row {row_id}: deliver at {report.deliver_at.strftime('%Y-%m-%d %H:%M UTC')}")
    print(f"  Pending: {outbox.pending_count()}")

    # Check what's due now (demo: nothing, since we just queued it 20 min out)
    due = outbox.due(now=utcnow())
    print(f"  Due now: {len(due)}")

    print("\n✓ Demo complete. Next: wire this pipeline into apps/onboard (NiceGUI).\n")
    return 0


if __name__ == "__main__":
    sys.exit(main())
