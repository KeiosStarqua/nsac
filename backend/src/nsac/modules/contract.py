"""Module contracts: each module is a pluggable health signal source."""

from __future__ import annotations

from typing import Protocol

from nsac.contracts import Deviation, Reading, Recommendation


class HealthModule(Protocol):
    """Contract every health module honors (cardio, musculoskeletal, space weather)."""

    name: str

    def detect(self, baseline: list[Reading], current: list[Reading]) -> list[Deviation]: ...

    def recommend(self, deviations: list[Deviation]) -> Recommendation | None: ...


__all__ = ["HealthModule"]
