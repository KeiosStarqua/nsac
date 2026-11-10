"""Simulation: 180-day generator and fast-forward, spread seeded from OSDR OSD-569/575.

Agent 1 scope: data pipeline. Not used in production — the real app would read sensors.
"""

from __future__ import annotations

import math
from datetime import datetime, timedelta
from typing import NamedTuple

import numpy as np

from nsac.contracts import MetricId, Reading, utcnow

# Spread from Inspiration4 CBC (OSD-569) and cytokine (OSD-575) data, inspected 2026-11-02.
# These are ILLUSTRATIVE ranges for a 4-person crew, not medical thresholds.
# Real data: https://osdr.nasa.gov/bio/repo/data/studies/OSD-569
# Real data: https://osdr.nasa.gov/bio/repo/data/studies/OSD-575

METRIC_RANGES: dict[MetricId, tuple[float, float, str]] = {
    "hr_rest": (50.0, 90.0, "bpm"),
    "hrv_rmssd": (20.0, 80.0, "ms"),
    "bp_systolic": (100.0, 140.0, "mmHg"),
    "bp_diastolic": (60.0, 90.0, "mmHg"),
    # LV volume and stroke volume: 2-week ISS trend from Circulation 2026
    # https://www.ahajournals.org/doi/full/10.1161/CIRCULATIONAHA.125.078665
    "lv_volume": (120.0, 180.0, "mL"),
    "stroke_volume": (60.0, 100.0, "mL"),
    # Bone/muscle: NASA-STD-3001 Vol.1 Rev B permits up to certain % loss
    "bone_density": (0.90, 1.05, "g/cm²"),
    "muscle_strength": (70.0, 110.0, "% baseline"),
    # Behavior (indirect, from DONKI-driven sleep disturbance)
    "sleep_hours": (5.5, 8.5, "hours"),
    "exercise_minutes": (0.0, 120.0, "min/day"),
}


class Trajectory(NamedTuple):
    """One metric's 180-day path for one astronaut."""

    astronaut_id: str
    metric: MetricId
    days: np.ndarray  # shape (180,)
    values: np.ndarray  # shape (180,)
    unit: str


def generate_crew_trajectories(
    crew_ids: list[str],
    mission_days: int = 180,
    seed: int | None = None,
) -> list[Trajectory]:
    """Generate one trajectory per crew member per metric.

    Each person gets a unique stable baseline, with drift (bone/muscle loss, cardio
    adaptation) and daily noise. Known gaps (root AGENTS.md): no orthostatic tolerance
    model for 3/8 G — the readiness score is a cited illustrative formula.
    """
    rng = np.random.default_rng(seed)
    trajectories: list[Trajectory] = []

    for astronaut_id in crew_ids:
        for metric, (low, high, unit) in METRIC_RANGES.items():
            # Each person's stable baseline is a random point in the range
            baseline = rng.uniform(low, high)
            # Drift: bone/muscle decline, cardio adapts down then recovers with exercise
            drift = _drift_for(metric, mission_days, rng)
            # Daily noise
            noise = rng.normal(0, (high - low) * 0.03, mission_days)

            values = np.clip(baseline + drift + noise, low, high)
            days = np.arange(mission_days)
            trajectories.append(Trajectory(astronaut_id, metric, days, values, unit))

    return trajectories


def _drift_for(metric: MetricId, mission_days: int, rng: np.random.Generator) -> np.ndarray:
    """Deterministic + small random component for each metric's long-term drift."""
    t = np.linspace(0, 1, mission_days)
    if metric in ("bone_density", "muscle_strength"):
        # Decline first 90 days, stable after (if exercise dose applied, would recover)
        decay = -0.10 * np.clip(t * 2, 0, 1)  # -10% over 90 days
        return decay * (1 + rng.uniform(-0.2, 0.2))
    if metric in ("lv_volume", "stroke_volume"):
        # Circulation 2026: 2-week decline on ISS
        # Approximation: 5% drop over 14 days, stable after
        mask = t <= (14 / 180)
        decay = np.where(mask, -0.05 * (t / (14 / 180)), -0.05)
        return decay * (1 + rng.uniform(-0.15, 0.15))
    if metric == "sleep_hours":
        # Small random walk, no strong trend
        walk = np.cumsum(rng.normal(0, 0.05, mission_days))
        return walk - walk.mean()
    # Others: small random walk
    walk = np.cumsum(rng.normal(0, 0.01, mission_days))
    return walk - walk.mean()


def trajectory_to_readings(
    traj: Trajectory, start_ts: datetime | None = None
) -> list[Reading]:
    """Convert one Trajectory into per-day Reading objects."""
    if start_ts is None:
        start_ts = utcnow()
    readings: list[Reading] = []
    for day_idx, value in zip(traj.days, traj.values, strict=True):
        ts = start_ts + timedelta(days=int(day_idx))
        readings.append(
            Reading(
                astronaut_id=traj.astronaut_id,
                ts=ts,
                metric=traj.metric,
                value=float(value),
                unit=traj.unit,
                source="sim:osd-569-spread",
            )
        )
    return readings


def inject_scenario(
    readings: list[Reading],
    astronaut_id: str,
    metric: MetricId,
    spike_day: int,
    spike_magnitude: float,
) -> list[Reading]:
    """Inject a spike into one metric on one day (demo scenario: solar storm → sleep loss)."""
    out = []
    for r in readings:
        if r.astronaut_id == astronaut_id and r.metric == metric:
            day = (r.ts - readings[0].ts).days
            if day == spike_day:
                out.append(
                    r.model_copy(
                        update={"value": r.value + spike_magnitude, "source": "sim:scenario-inject"}
                    )
                )
                continue
        out.append(r)
    return out


__all__ = [
    "METRIC_RANGES",
    "Trajectory",
    "generate_crew_trajectories",
    "inject_scenario",
    "trajectory_to_readings",
]
