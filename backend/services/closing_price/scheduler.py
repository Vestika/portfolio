"""
APScheduler Service for Historical Price Caching

This module sets up scheduled jobs for the historical price caching system:
1. Historical sync (every 3 hours) - Transfers prices from cache to MongoDB
2. Live price updates (every 15 minutes) - Updates in-memory cache with latest prices
3. Earnings sync (every 24 hours) - Fetches and caches earnings data

The scheduler runs in the background and is initialized on app startup.
"""
import asyncio
from typing import Optional
from loguru import logger
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from apscheduler.triggers.interval import IntervalTrigger

from .historical_sync import get_sync_service
from .live_price_updater import get_updater_service


class CacheSchedulerService:
    """Manages scheduled jobs for the caching system"""
    
    def __init__(self):
        self.scheduler: Optional[AsyncIOScheduler] = None
        self.sync_service = get_sync_service()
        self.updater_service = get_updater_service()
    
    def start(self) -> None:
        """
        Start the scheduler and all scheduled jobs.
        
        Jobs:
        - Historical sync: Immediately on startup, then every 3 hours
        - Live price updates: Immediately on startup, then every 15 minutes
        """
        if self.scheduler is not None:
            logger.warning("[SCHEDULER] Scheduler already running")
            return
        
        try:
            # Create scheduler
            self.scheduler = AsyncIOScheduler()
            
            # Job 1: Historical sync every 3 hours (at top of hour)
            # Runs at: 00:00, 03:00, 06:00, 09:00, 12:00, 15:00, 18:00, 21:00
            self.scheduler.add_job(
                func=self._run_historical_sync,
                trigger=CronTrigger(hour='*/3', minute='0'),
                id='historical_sync',
                name='Historical Price Sync (Every 3 hours)',
                replace_existing=True,
                max_instances=1  # Prevent overlapping runs
            )
            
            # Job 2: Live price updates every 15 minutes
            self.scheduler.add_job(
                func=self._run_live_update,
                trigger=IntervalTrigger(minutes=15),
                id='live_price_update',
                name='Live Price Update (Every 15 minutes)',
                replace_existing=True,
                max_instances=1  # Prevent overlapping runs
            )
            
            # Job 3: Earnings sync every 24 hours (at midnight)
            self.scheduler.add_job(
                func=self._run_earnings_sync,
                trigger=CronTrigger(hour='0', minute='0'),
                id='earnings_sync',
                name='Earnings Sync (Daily at midnight)',
                replace_existing=True,
                max_instances=1
            )
            
            # Start the scheduler
            self.scheduler.start()
            
            logger.info(
                "[SCHEDULER] Started with jobs:\n"
                "  - Historical sync: Every 3 hours at :00\n"
                "  - Live price updates: Every 15 minutes\n"
                "  - Earnings sync: Daily at midnight"
            )
            
            # Run initial sync immediately (T+0)
            logger.info("[SCHEDULER] Triggering initial sync immediately (T+0)")
            self.scheduler.add_job(
                func=self._run_historical_sync,
                id='initial_historical_sync',
                name='Initial Historical Sync (T+0)',
                replace_existing=True
            )
            
            # Run initial live update immediately (T+0)
            logger.info("[SCHEDULER] Triggering initial live update immediately (T+0)")
            self.scheduler.add_job(
                func=self._run_live_update,
                id='initial_live_update',
                name='Initial Live Update (T+0)',
                replace_existing=True
            )
            
            # Run initial earnings sync immediately (T+0)
            logger.info("[SCHEDULER] Triggering initial earnings sync immediately (T+0)")
            self.scheduler.add_job(
                func=self._run_earnings_sync,
                id='initial_earnings_sync',
                name='Initial Earnings Sync (T+0)',
                replace_existing=True
            )
            
        except Exception as e:
            logger.error(f"[SCHEDULER] Error starting scheduler: {e}")
            raise
    
    def stop(self) -> None:
        """Stop the scheduler"""
        if self.scheduler:
            self.scheduler.shutdown(wait=True)
            self.scheduler = None
            logger.info("[SCHEDULER] Scheduler stopped")
    
    def get_jobs(self) -> list[dict]:
        """
        Get information about all scheduled jobs.
        
        Returns:
            List of job information dictionaries
        """
        if not self.scheduler:
            return []
        
        jobs = []
        for job in self.scheduler.get_jobs():
            jobs.append({
                "id": job.id,
                "name": job.name,
                "next_run": job.next_run_time.isoformat() if job.next_run_time else None,
                "trigger": str(job.trigger)
            })
        
        return jobs
    
    async def _run_historical_sync(self) -> None:
        """Wrapper for historical sync job"""
        try:
            logger.info("[SCHEDULER] Running historical sync job")
            result = await self.sync_service.run_daily_sync()
            logger.info(
                f"[SCHEDULER] Historical sync completed: "
                f"{result['total_symbols_updated']} symbols updated, "
                f"{result['total_errors']} errors"
            )
        except Exception as e:
            logger.error(f"[SCHEDULER] Error in historical sync job: {e}")
    
    async def _run_live_update(self) -> None:
        """Wrapper for live update job"""
        try:
            logger.info("[SCHEDULER] Running live price update job")
            result = await self.updater_service._update_all_prices()
            logger.info(
                f"[SCHEDULER] Live update completed: "
                f"{result['updated']} symbols updated, "
                f"{result['errors']} errors"
            )
        except Exception as e:
            logger.error(f"[SCHEDULER] Error in live update job: {e}")
    
    async def _run_earnings_sync(self) -> None:
        """Wrapper for earnings sync job"""
        try:
            logger.info("[SCHEDULER] Running earnings sync job")
            from services.earnings_cache import get_earnings_cache_service
            
            earnings_service = get_earnings_cache_service()
            result = await earnings_service.sync_earnings_for_tracked_stocks()
            
            logger.info(
                f"[SCHEDULER] Earnings sync completed: "
                f"{result['success_count']} symbols updated, "
                f"{result['error_count']} errors"
            )
        except Exception as e:
            logger.error(f"[SCHEDULER] Error in earnings sync job: {e}")
    
    def trigger_historical_sync_now(self) -> None:
        """Manually trigger historical sync job immediately"""
        if self.scheduler:
            self.scheduler.modify_job('historical_sync', next_run_time=None)
            logger.info("[SCHEDULER] Triggered historical sync to run immediately")
    
    def trigger_live_update_now(self) -> None:
        """Manually trigger live update job immediately"""
        if self.scheduler:
            self.scheduler.modify_job('live_price_update', next_run_time=None)
            logger.info("[SCHEDULER] Triggered live update to run immediately")


# Global singleton instance
_scheduler_service: Optional[CacheSchedulerService] = None


def get_scheduler_service() -> CacheSchedulerService:
    """Get the global scheduler service instance"""
    global _scheduler_service
    if _scheduler_service is None:
        _scheduler_service = CacheSchedulerService()
        logger.info("[SCHEDULER] Initialized scheduler service")
    return _scheduler_service


def start_scheduler() -> None:
    """
    Start the global scheduler service.
    
    This should be called once during application startup.
    """
    scheduler = get_scheduler_service()
    scheduler.start()


def stop_scheduler() -> None:
    """
    Stop the global scheduler service.
    
    This should be called during application shutdown.
    """
    scheduler = get_scheduler_service()
    scheduler.stop()

