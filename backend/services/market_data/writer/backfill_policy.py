"""Backfill policy -- decides whether a symbol needs data on startup."""

from __future__ import annotations

from datetime import date, timedelta


class BackfillPolicy:
    """Decides whether a symbol needs backfilling on startup.

    This is ONLY used for startup optimization.  The daily scheduled backfill
    always enqueues all symbols unconditionally.

    On startup, we skip symbols that were recently backfilled (within
    *staleness_days*) to avoid redundant API calls after a quick app restart.
    """

    def __init__(self, staleness_days: int = 3) -> None:
        self._staleness_days = staleness_days

    def needs_startup_backfill(
        self,
        last_bar_date: date | None,
        as_of: date | None = None,
    ) -> bool:
        """True if the symbol should be backfilled on startup.

        - ``last_bar_date is None`` -> always True (no data at all).
        - Gap >= *staleness_days* -> True (stale).
        - Otherwise -> False (recently updated, skip).
        """
        if last_bar_date is None:
            return True
        if as_of is None:
            as_of = date.today()
        gap = (as_of - last_bar_date).days
        return gap >= self._staleness_days

    def compute_backfill_start(
        self,
        last_bar_date: date | None,
        retention_days: int,
    ) -> date:
        """Compute the start date for a backfill request.

        - No data -> start from ``(today - retention_days)``.
        - Otherwise -> start from ``(last_bar_date + 1 day)``.
        """
        if last_bar_date is None:
            return date.today() - timedelta(days=retention_days)
        return last_bar_date + timedelta(days=1)
