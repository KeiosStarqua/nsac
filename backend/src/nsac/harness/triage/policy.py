"""Pure triage policy: deterministic findings first, one action only."""

from __future__ import annotations

from nsac.contracts import Deviation, Recommendation

CHECKLIST_DOC = "ISS Medical Checklist"
CHECKLIST_SOURCE = "https://newspaceeconomy.ca/wp-content/uploads/2022/11/163533main_iss_med_cl.pdf"


def recommend(deviations: list[Deviation], *, days_to_landing: int = 14) -> Recommendation | None:
    """Choose one conservative draft; an astronaut must confirm it downstream."""
    red = [d for d in deviations if d.severity == "red"]
    yellow = [d for d in deviations if d.severity == "yellow"]
    if red:
        return Recommendation(
            action="contact_ground",
            dose="Pause the planned dose and contact the flight surgeon",
            checklist_ref={"doc": CHECKLIST_DOC, "page": 1},
            rationale=f"Red deterministic deviation in {red[0].metric}; human review required.",
        )
    if days_to_landing <= 1:
        return Recommendation(
            action="safety_compression_garment",
            dose="Use compression garment and stand with assistance",
            checklist_ref={"doc": CHECKLIST_DOC, "page": 1},
            rationale="Landing is imminent; prefer the conservative safety action.",
        )
    if any(d.metric in {"muscle_strength", "exercise_minutes"} for d in yellow):
        return Recommendation(
            action="exercise_dose",
            dose="Complete the next scheduled supervised exercise dose",
            checklist_ref={"doc": CHECKLIST_DOC, "page": 1},
            rationale="Yellow musculoskeletal/exercise trend; restore the planned dose.",
        )
    if any(d.metric == "sleep_hours" for d in yellow):
        return Recommendation(
            action="rest_shift",
            dose="Protect the next sleep opportunity and re-measure tomorrow",
            checklist_ref={"doc": CHECKLIST_DOC, "page": 1},
            rationale="Yellow sleep trend; reduce load before adding another intervention.",
        )
    return None


__all__ = ["CHECKLIST_DOC", "CHECKLIST_SOURCE", "recommend"]
