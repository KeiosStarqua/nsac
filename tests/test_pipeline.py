"""End-to-end smoke test: generator → detection → readiness → confirm gate → outbox → report."""

from __future__ import annotations

from datetime import timedelta

import pytest

from nsac.adapters.sqlite.outbox import DELAY_MINUTES, Outbox
from nsac.agent.session import AgentSession
from nsac.api.pipeline import MissionPipeline
from nsac.contracts import Reading, utcnow
from nsac.domain.health import detect, readiness
from nsac.reporting.render import render_report_html
from nsac.simulation import generate_crew_trajectories, inject_scenario, trajectory_to_readings

CREW = ["astro-1"]


def _readings_for(metric: str):
    trajs = generate_crew_trajectories(CREW, mission_days=60, seed=42)
    traj = next(t for t in trajs if t.metric == metric)
    return trajectory_to_readings(traj)


def test_generator_produces_all_metrics_for_crew():
    trajs = generate_crew_trajectories(CREW, mission_days=30, seed=1)
    assert len(trajs) == 10  # 10 metrics × 1 astronaut
    assert all(len(t.values) == 30 for t in trajs)


def test_detection_flags_injected_spike():
    baseline = _readings_for("sleep_hours")[:50]
    current = _readings_for("sleep_hours")[50:53]
    spiked = inject_scenario(current, "astro-1", "sleep_hours", spike_day=1, spike_magnitude=-3.0)
    deviations = detect(baseline, spiked)
    assert deviations, "expected at least one deviation record"
    sleep_dev = next(d for d in deviations if d.metric == "sleep_hours")
    assert sleep_dev.severity in {"yellow", "red"}
    assert sleep_dev.threshold_source_url.startswith("http")


def test_readiness_weights_sum_and_score_range():
    score = readiness(cardio=70, musculoskeletal=55, exercise_adherence=40, ts=utcnow())
    assert 0 <= score.score <= 100
    assert abs(sum(c.weight for c in score.components) - 1.0) < 1e-6
    assert all(c.source_url.startswith("http") for c in score.components)


def test_confirm_gate_blocks_unconfirmed_action():
    session = AgentSession(days_to_landing=10)
    assert session.confirmed_actions == []
    # Without a draft there is nothing to confirm
    assert session.confirm() is None


def test_full_pipeline_report_and_outbox_delay():
    pipeline = MissionPipeline(mission_day=170)
    baseline = _readings_for("hr_rest")[:40]
    current = _readings_for("hr_rest")[40:42]
    deviations = pipeline.evaluate(baseline, current)
    pipeline.score(cardio=62, musculoskeletal=58, exercise_adherence=45)
    draft = pipeline.draft()
    if draft is not None:
        taken = pipeline.confirm()
        assert taken is not None and taken.applied
    report = pipeline.report(summary="Day 170 check-in")
    assert report.mission_day == 170
    outbox = Outbox()
    outbox.queue(report)
    assert outbox.pending_count() == 1
    # Not due before the simulated 20-minute delay
    assert outbox.due(now=report.queued_at + timedelta(minutes=1)) == []
    due = outbox.due(now=report.queued_at + timedelta(minutes=DELAY_MINUTES + 1))
    assert len(due) == 1 and due[0].mission_day == 170


def test_report_html_renders_disclaimer_and_sources():
    pipeline = MissionPipeline(mission_day=170)
    baseline = _readings_for("hr_rest")[:40]
    current = _readings_for("hr_rest")[40:42]
    pipeline.evaluate(baseline, current)
    pipeline.score(cardio=62, musculoskeletal=58, exercise_adherence=45)
    pipeline.draft()
    pipeline.confirm()
    report = pipeline.report(summary="Smoke test")
    html = render_report_html(report)
    assert "AI-generated, not a substitute for a physician." in html
    assert "nasa.gov" in html or "NASA-STD" in html or "https://" in html
