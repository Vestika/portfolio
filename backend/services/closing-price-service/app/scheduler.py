from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from loguru import logger
from typing import Optional

from .config import settings
from .services.price_manager import PriceManager


class BackgroundScheduler:
    """Background scheduler for automated price refresh"""
    
    def __init__(self) -> None:
        self.scheduler: Optional[AsyncIOScheduler] = None
        self.price_manager = PriceManager()
    
    async def start(self) -> None:
        """Start the background scheduler"""
        try:
            self.scheduler = AsyncIOScheduler()
            
            # Schedule daily refresh job
            self.scheduler.add_job(
                self._daily_refresh_job,
                CronTrigger(
                    hour=settings.refresh_job_hour,
                    minute=settings.refresh_job_minute
                ),
                id="daily_price_refresh",
                name="Daily Price Refresh",
                replace_existing=True
            )
            
            self.scheduler.start()
            logger.info(f"Background scheduler started - daily refresh at {settings.refresh_job_hour:02d}:{settings.refresh_job_minute:02d}")
            
        except Exception as e:
            logger.error(f"Failed to start background scheduler: {e}")
            raise
    
    async def stop(self) -> None:
        """Stop the background scheduler"""
        if self.scheduler:
            self.scheduler.shutdown()
            logger.info("Background scheduler stopped")
    
    async def _daily_refresh_job(self) -> None:
        """Daily job to refresh all tracked symbol prices"""
        try:
            logger.info("Starting daily price refresh job")
            result = await self.price_manager.refresh_tracked_symbols()
            
            logger.info(
                f"Daily refresh completed: {result['message']}, "
                f"Failed symbols: {result['failed_symbols']}"
            )
            
        except Exception as e:
            logger.error(f"Error in daily refresh job: {e}")
    
    async def trigger_refresh(self) -> None:
        """Manually trigger a refresh job (for testing/debugging)"""
        await self._daily_refresh_job()


# Global scheduler instance
scheduler = BackgroundScheduler() 