"""End-to-end pipeline: readings → deviations → readiness → draft → confirm → report."""

from __future__ import annotations

from datetime import datetime

from nsac.agent.session import AgentSession
from nsac.adapters.sqlite.outbox import DELAY_MINUTES, Outbox
from nsac.contracts import (
    ActionTaken,
    Deviation,
    GroundReport,
    ReadinessScore,
    Reading,
    Recommendation,
    utcnow,
)
from nsac.domain.health import detect, readiness


class MissionPipeline:
    """Thin orchestration over the domain + harness + adapters.

    UI layers (NiceGUI) call only this class; it owns no UI concerns.
    """

    def __init__(self, mission_day: int = 0):
        self.mission_day = mission_day
        self.session = AgentSession(days_to_landing=max(0, 14 - mission_day))
        self._last_deviations: list[Deviation] = []
        self._last_readiness: ReadinessScore | None = None

    def evaluate(self, baseline: list[Reading], current: list[Reading]) -> list[Deviation]:
        self._last_deviations = detect(baseline, current)
        return self._last_deviations

    def score(self, *, cardio: float, musculoskeletal: float, exercise_adherence: float) -> ReadinessScore:
        self._last_readiness = readiness(
            cardio=cardio,
            musculoskeletal=musculoskeletal,
            exercise_adherence=exercise_adherence,
            ts=utcnow(),
        )
        return self._last_readiness

    def draft(self) -> Recommendation | None:
        return self.session.draft(self._last_deviations)

    def confirm(self) -> ActionTaken | None:
        return self.session.confirm()

    def reject(self) -> None:
        self.session.reject()

    def report(self, summary: str, queued_at: datetime | None = None) -> GroundReport:
        queued = queued_at or utcnow()
        return GroundReport(
            mission_day=self.mission_day,
            summary=summary,
            deviations=self._last_deviations,
            actions_taken=list(self.session.confirmed_actions),
            readiness=self._last_readiness,
            queued_at=queued,
            deliver_at=Outbox.deliver_at_after(queued),
        )

    def queue(self, report: GroundReport, outbox: Outbox) -> int:
        return outbox.queue(report)


__all__ = ["DELAY_MINUTES", "MissionPipeline"]
