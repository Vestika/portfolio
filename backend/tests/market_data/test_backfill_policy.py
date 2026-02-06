"""BackfillPolicy unit tests."""

from datetime import date, timedelta

from services.market_data.writer.backfill_policy import BackfillPolicy


class TestBackfillPolicy:
    def test_no_data_always_needs_startup_backfill(self):
        policy = BackfillPolicy(staleness_days=3)
        assert policy.needs_startup_backfill(last_bar_date=None) is True

    def test_fresh_data_skipped_on_startup(self):
        policy = BackfillPolicy(staleness_days=3)
        yesterday = date.today() - timedelta(days=1)
        assert policy.needs_startup_backfill(yesterday) is False

    def test_stale_data_needs_startup_backfill(self):
        policy = BackfillPolicy(staleness_days=3)
        four_days_ago = date.today() - timedelta(days=4)
        assert policy.needs_startup_backfill(four_days_ago) is True

    def test_exactly_at_threshold(self):
        policy = BackfillPolicy(staleness_days=3)
        three_days_ago = date.today() - timedelta(days=3)
        assert policy.needs_startup_backfill(three_days_ago) is True

    def test_weekend_no_false_positive(self):
        policy = BackfillPolicy(staleness_days=3)
        # Friday -> Sunday = 2 days, below threshold
        friday = date(2026, 2, 6)  # A Friday
        sunday = date(2026, 2, 8)  # The following Sunday
        assert policy.needs_startup_backfill(friday, as_of=sunday) is False

    def test_compute_start_no_data(self):
        policy = BackfillPolicy()
        start = policy.compute_backfill_start(None, retention_days=365)
        expected = date.today() - timedelta(days=365)
        assert start == expected

    def test_compute_start_with_data(self):
        policy = BackfillPolicy()
        last = date(2026, 1, 15)
        start = policy.compute_backfill_start(last, retention_days=365)
        assert start == date(2026, 1, 16)
