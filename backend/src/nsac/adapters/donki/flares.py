"""DONKI space-weather adapter (offline-safe: returns empty on any failure).

Data: https://ccmc.gsfc.nasa.gov/tools/DONKI/ — used only to shift sleep quality
after a solar storm, per the demo scenario (README "Demo (60 giây)").
"""

from __future__ import annotations

import json
import os
import urllib.request
from dataclasses import dataclass
from datetime import date, timedelta

DONKI_URL = "https://kauai.ccmc.gsfc.nasa.gov/DONKI/WS/get/FLR"
_TIMEOUT_S = 10.0


@dataclass(frozen=True)
class SolarEvent:
    event_id: str
    start_time: date
    class_type: str


def recent_flares(days: int = 7, api_key: str | None = None) -> list[SolarEvent]:
    """Query DONKI for recent solar flares; empty list offline (rule 1: must run offline)."""
    key = api_key or os.environ.get("NASA_API_KEY", "DEMO_KEY")
    start = (date.today() - timedelta(days=days)).isoformat()
    url = f"{DONKI_URL}?startDate={start}&endDate={date.today().isoformat()}&api_key={key}"
    request = urllib.request.Request(url, headers={"Accept": "application/json"})
    try:
        with urllib.request.urlopen(request, timeout=_TIMEOUT_S) as response:
            payload = json.loads(response.read())
    except (urllib.error.URLError, TimeoutError, json.JSONDecodeError):
        return []
    events: list[SolarEvent] = []
    for item in payload if isinstance(payload, list) else []:
        try:
            events.append(
                SolarEvent(
                    event_id=str(item["flrID"]),
                    start_time=date.fromisoformat(item["beginTime"][:10]),
                    class_type=str(item.get("classType", "")),
                )
            )
        except (KeyError, ValueError):
            continue
    return events


def sleep_penalty(events: list[SolarEvent], on_day: date) -> float:
    """Minutes of sleep quality penalty the day after a strong flare (demo heuristic)."""
    penalty = 0.0
    for event in events:
        if event.start_time == on_day - timedelta(days=1) and event.class_type.startswith(("M", "X")):
            penalty += 30.0
    return penalty


import urllib.error  # noqa: E402  (kept last so the offline import path stays obvious)


__all__ = ["DONKI_URL", "SolarEvent", "recent_flares", "sleep_penalty"]
