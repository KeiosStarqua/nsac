"""Transparent Mars landing readiness calculation."""

from __future__ import annotations

from datetime import datetime

from nsac.contracts import ReadinessScore, ScoreComponent

# Source for exercise/musculoskeletal rationale: NASA-STD-3001 Vol 1 Rev B.
NASA_STD = "https://www.nasa.gov/wp-content/uploads/2020/10/2022-01-05_nasa-std-3001_vol.1_rev._b_final_draft_with_signature_010522.pdf"

WEIGHTS = {
    "cardio": (0.40, f"{NASA_STD}#V1-4001"),
    "musculoskeletal": (0.40, f"{NASA_STD}#V1-4023"),
    "exercise_adherence": (0.20, f"{NASA_STD}#V1-5002"),
}


def readiness(
    *, cardio: float, musculoskeletal: float, exercise_adherence: float, ts: datetime
) -> ReadinessScore:
    """Calculate a cited, illustrative 0–100 score.

    This is not an orthostatic-tolerance model; root AGENTS.md records that no
    open model exists for 3/8 G. Each input is clamped to the display range.
    """
    values = {
        "cardio": max(0.0, min(100.0, cardio)),
        "musculoskeletal": max(0.0, min(100.0, musculoskeletal)),
        "exercise_adherence": max(0.0, min(100.0, exercise_adherence)),
    }
    components = [
        ScoreComponent(name=name, value=value, weight=WEIGHTS[name][0], source_url=WEIGHTS[name][1])
        for name, value in values.items()
    ]
    score = sum(c.value * c.weight for c in components)
    return ReadinessScore(score=score, components=components, ts=ts)


__all__ = ["NASA_STD", "WEIGHTS", "readiness"]
