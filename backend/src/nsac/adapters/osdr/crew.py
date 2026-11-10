"""OSDR adapter (placeholder — hardware/OSDR access is a known gap).

Root AGENTS.md: Agent 1 pulls OSDR OSD-569/575 via httpx; this adapter stays offline-safe
so demo day never depends on a network call.
"""

from __future__ import annotations

from typing import Any

from nsac.contracts import MetricId, Reading


def fetch_crew_csv(study_id: str, *, limit_days: int | None = None) -> list[dict[str, Any]]:
    """Return [] offline — replace with real OSDR pull via httpx (Agent 1 scope)."""
    del study_id, limit_days
    return []


def to_reading(payload: dict[str, Any], astronaut_id: str, metric: MetricId) -> Reading:
    """Normalize one OSDR row into a Reading (stub until real fetch exists)."""
    raise NotImplementedError("Real OSDR mapping is Agent 1 scope after the pull works online.")


__all__ = ["fetch_crew_csv", "to_reading"]
