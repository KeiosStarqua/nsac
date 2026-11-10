"""Adapters: concrete IO implementations of domain/module interfaces."""

from nsac.adapters.sqlite.outbox import DELAY_MINUTES, Outbox

__all__ = ["DELAY_MINUTES", "Outbox"]
