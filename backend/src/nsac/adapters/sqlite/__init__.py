"""SQLite adapter."""

from nsac.adapters.sqlite.outbox import DELAY_MINUTES, Outbox

__all__ = ["DELAY_MINUTES", "Outbox"]
