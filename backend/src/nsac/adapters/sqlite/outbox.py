"""SQLite outbox for the 20-minute delayed Earth link."""

from __future__ import annotations

import sqlite3
from datetime import timedelta
from pathlib import Path

from nsac.contracts import GroundReport, utcnow

DELAY_MINUTES = 20  # Demo scenario (README): Earth link delay, simulated.


class Outbox:
    """Queue reports in SQLite, deliver after the simulated link delay."""

    def __init__(self, db_path: Path | str = ":memory:"):
        self._conn = sqlite3.connect(str(db_path))
        self._conn.execute(
            """
            CREATE TABLE IF NOT EXISTS outbox (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                queued_at TEXT NOT NULL,
                deliver_at TEXT NOT NULL,
                payload TEXT NOT NULL
            )
            """
        )
        self._conn.commit()

    def queue(self, report: GroundReport) -> int:
        payload = report.model_dump_json()
        with self._conn as conn:
            cursor = conn.execute(
                "INSERT INTO outbox (queued_at, deliver_at, payload) VALUES (?, ?, ?)",
                (report.queued_at.isoformat(), report.deliver_at.isoformat(), payload),
            )
        return int(cursor.lastrowid)

    def due(self, now: datetime | None = None) -> list[GroundReport]:
        now = now or utcnow()
        rows = self._conn.execute(
            "SELECT id, payload FROM outbox WHERE deliver_at <= ? ORDER BY queued_at",
            (now.isoformat(),),
        ).fetchall()
        return [GroundReport.model_validate_json(payload) for _, payload in rows]

    def pending_count(self) -> int:
        row = self._conn.execute("SELECT COUNT(*) FROM outbox").fetchone()
        return int(row[0])

    @staticmethod
    def deliver_at_after(queued_at: datetime, delay_minutes: int = DELAY_MINUTES) -> datetime:
        return queued_at + timedelta(minutes=delay_minutes)


__all__ = ["DELAY_MINUTES", "Outbox"]
