"""Synthesis agent: deterministic pipeline with a hard astronaut confirmation gate.

Hard rule 4 (root AGENTS.md): detection is deterministic; the LLM only explains.
`draft()` produces a Recommendation; nothing is applied until `confirm()` is called.
The optional Ollama narration (`narrate`) only rewords the rationale — the action,
dose and checklist reference always come from the deterministic policy.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime

from nsac.contracts import (
    ActionTaken,
    Deviation,
    Recommendation,
    utcnow,
)
from nsac.harness.triage import recommend


@dataclass
class PendingAction:
    """A drafted recommendation awaiting astronaut confirmation."""

    recommendation: Recommendation
    drafted_at: datetime
    confirmed: bool = False


@dataclass
class AgentSession:
    """One mission-day session: detect → draft → confirm → record."""

    days_to_landing: int = 14
    pending: PendingAction | None = None
    confirmed_actions: list[ActionTaken] = field(default_factory=list)

    def draft(self, deviations: list[Deviation]) -> Recommendation | None:
        """Deterministic draft. Overwrites any un-confirmed pending action."""
        rec = recommend(deviations, days_to_landing=self.days_to_landing)
        self.pending = PendingAction(recommendation=rec, drafted_at=utcnow()) if rec else None
        return rec

    def confirm(self) -> ActionTaken | None:
        """The astronaut's one-click confirmation. Returns the applied action."""
        if self.pending is None or self.pending.confirmed:
            return None
        rec = self.pending.recommendation
        self.pending.confirmed = True
        taken = ActionTaken(action=rec.action, dose=rec.dose, confirmed_at=utcnow(), applied=True)
        self.confirmed_actions.append(taken)
        return taken

    def reject(self) -> None:
        """The astronaut declines; nothing is applied or reported as taken."""
        self.pending = None


__all__ = ["AgentSession", "PendingAction"]
