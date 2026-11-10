"""Shared Pydantic schemas (the "shared contract, hour 1" of the BOD 18/10 scope).

Every module, harness rule, adapter and the UI exchange only these types.
Pure data — no IO, no imports from other layers.

Hard rule 3 (root AGENTS.md): every threshold, weight and claim that reaches a
schema field must carry its source URL, so the UI can always show provenance.
"""

from __future__ import annotations

import math
from datetime import datetime, timezone
from enum import Enum
from typing import Literal

from pydantic import BaseModel, Field, field_validator

MetricId = Literal[
    "hr_rest",
    "hrv_rmssd",
    "bp_systolic",
    "bp_diastolic",
    "lv_volume",
    "stroke_volume",
    "bone_density",
    "muscle_strength",
    "sleep_hours",
    "exercise_minutes",
]

Severity = Literal["green", "yellow", "red"]


def utcnow() -> datetime:
    """Timestamp helper so all records share one clock definition."""
    return datetime.now(timezone.utc)


class Reading(BaseModel):
    """One measurement of one metric for one astronaut at one time.

    Produced by the simulation generator or by a real adapter (OSDR, DONKI).
    """

    astronaut_id: str = Field(min_length=1)
    ts: datetime
    metric: MetricId
    value: float
    unit: str = Field(min_length=1)
    source: str = Field(
        min_length=1,
        description="Provenance, e.g. 'sim:osd-569-spread' or 'donki:CME-2026-...'",
    )

    @field_validator("ts")
    @classmethod
    def _require_tz(cls, v: datetime) -> datetime:
        if v.tzinfo is None:
            raise ValueError("ts must be timezone-aware")
        return v


class Deviation(BaseModel):
    """One metric off its per-person baseline, judged deterministic (hard rule 4)."""

    metric: MetricId
    value: float
    baseline_median: float
    baseline_mad: float
    z: float
    slope: float = Field(description="Per-day trend, from EWMA/linear fit over the window.")
    severity: Severity
    threshold_source_url: str = Field(
        min_length=1,
        description="URL of the document the green/yellow/red cut comes from.",
    )


class ChecklistRef(BaseModel):
    """Where in a NASA document the action is authorized (agent scope rule)."""

    doc: str = Field(min_length=1, description="Document id, e.g. 'ISS-medical-checklist'.")
    page: int = Field(ge=1)


class Recommendation(BaseModel):
    """One proposed action. The agent may only draft it; the astronaut confirms it."""

    action: Literal[
        "exercise_dose",
        "safety_compression_garment",
        "assisted_stand",
        "rest_shift",
        "contact_ground",
    ]
    dose: str = Field(min_length=1, description="Concrete dose, e.g. '40 min aerobic @ 70% HRmax'.")
    checklist_ref: ChecklistRef
    rationale: str = Field(min_length=1)
    requires_confirmation: Literal[True] = True


class ScoreComponent(BaseModel):
    """One weighted input of the readiness score, with its citation."""

    name: str = Field(min_length=1)
    value: float = Field(ge=0, le=100)
    weight: float = Field(gt=0, le=1)
    source_url: str = Field(min_length=1)


class ReadinessScore(BaseModel):
    """Mars landing readiness 0–100: transparent formula, one cited source per weight."""

    score: float = Field(ge=0, le=100)
    components: list[ScoreComponent] = Field(min_length=1, max_length=8)
    ts: datetime

    @field_validator("components")
    @classmethod
    def _weights_sum_to_one(cls, v: list[ScoreComponent]) -> list[ScoreComponent]:
        total = sum(c.weight for c in v)
        if not math.isclose(total, 1.0, abs_tol=1e-6):
            raise ValueError(f"component weights must sum to 1.0, got {total}")
        return v

    @field_validator("score")
    @classmethod
    def _score_rounded(cls, v: float) -> float:
        return round(v, 1)


class ActionTaken(BaseModel):
    """An action the astronaut confirmed and that was applied."""

    action: str = Field(min_length=1)
    dose: str = Field(min_length=1)
    confirmed_at: datetime
    applied: bool = True


class GroundReport(BaseModel):
    """What the delayed link delivers to the flight surgeon (20-minute outbox)."""

    mission_day: int = Field(ge=0)
    summary: str = Field(min_length=1)
    deviations: list[Deviation] = Field(default_factory=list)
    actions_taken: list[ActionTaken] = Field(default_factory=list)
    readiness: ReadinessScore | None = None
    queued_at: datetime
    deliver_at: datetime

    @field_validator("deliver_at")
    @classmethod
    def _deliver_after_queue(cls, v: datetime, info) -> datetime:
        queued = info.data.get("queued_at")
        if queued is not None and v <= queued:
            raise ValueError("deliver_at must be after queued_at")
        return v


__all__ = [
    "ActionTaken",
    "ChecklistRef",
    "Deviation",
    "GroundReport",
    "MetricId",
    "ReadinessScore",
    "Reading",
    "Recommendation",
    "ScoreComponent",
    "Severity",
    "utcnow",
]
