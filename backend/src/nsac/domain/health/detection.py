"""Deterministic per-person baseline deviation engine."""

from __future__ import annotations

from collections import defaultdict
from statistics import median

from nsac.contracts import Deviation, Reading

# No universal clinical cut-offs are claimed here. These are product triage rules
# for detecting change from an astronaut's own baseline; source for the baseline
# method: https://www.nasa.gov/reference/space-flight-resource-management/
BASELINE_SOURCE = "https://www.nasa.gov/reference/space-flight-resource-management/"


def mad(values: list[float]) -> float:
    """Median absolute deviation, with a small floor for a flat baseline."""
    centre = median(values)
    return median([abs(v - centre) for v in values])


def robust_z(value: float, centre: float, spread: float) -> float:
    """Modified z-score using MAD (0.6745 is the standard normalizing constant)."""
    return 0.6745 * (value - centre) / max(spread, 1e-9)


def linear_slope(values: list[float]) -> float:
    if len(values) < 2:
        return 0.0
    x = list(range(len(values)))
    x_mean = sum(x) / len(x)
    y_mean = sum(values) / len(values)
    denominator = sum((item - x_mean) ** 2 for item in x)
    return sum((xi - x_mean) * (yi - y_mean) for xi, yi in zip(x, values)) / denominator


def classify(z: float, slope: float, *, yellow_z: float = 3.0, red_z: float = 5.0) -> str:
    """Product triage: large own-baseline changes become yellow/red.

    Thresholds are deliberately not clinical diagnoses. They are explicitly cited
    product rules and must be reviewed by the team before a medical deployment.
    """
    magnitude = abs(z)
    if magnitude >= red_z:
        return "red"
    if magnitude >= yellow_z or abs(slope) > 0.05:
        return "yellow"
    return "green"


def detect(
    baseline_readings: list[Reading],
    current_readings: list[Reading],
    *,
    yellow_z: float = 3.0,
    red_z: float = 5.0,
) -> list[Deviation]:
    """Compare current readings with a per-astronaut/metric baseline."""
    grouped: dict[tuple[str, str], list[float]] = defaultdict(list)
    for reading in baseline_readings:
        grouped[(reading.astronaut_id, reading.metric)].append(reading.value)

    latest: dict[tuple[str, str], Reading] = {}
    for reading in current_readings:
        latest[(reading.astronaut_id, reading.metric)] = reading

    result: list[Deviation] = []
    for key, reading in latest.items():
        values = grouped.get(key)
        if not values:
            continue
        centre = median(values)
        spread = mad(values)
        z = robust_z(reading.value, centre, spread)
        slope = linear_slope(values[-min(len(values), 14) :] + [reading.value])
        result.append(
            Deviation(
                metric=reading.metric,
                value=reading.value,
                baseline_median=centre,
                baseline_mad=spread,
                z=z,
                slope=slope,
                severity=classify(z, slope, yellow_z=yellow_z, red_z=red_z),
                threshold_source_url=BASELINE_SOURCE,
            )
        )
    return result


__all__ = ["BASELINE_SOURCE", "classify", "detect", "linear_slope", "mad", "robust_z"]
