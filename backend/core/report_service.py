"""
Report Service for managing report subscriptions and generation.

Handles:
- Subscription CRUD operations
- Email verification
- Report generation and delivery
- Scheduling logic
"""

from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional
from bson import ObjectId
import secrets
import logging

from models.report_models import (
    ReportSubscription, ReportHistory, ReportSections,
    ReportFrequency, ReportFormat, ReportStatus,
    CreateSubscriptionRequest, UpdateSubscriptionRequest
)
from services.reports.report_generator import (
    ReportGenerator, PortfolioReportData, get_report_generator
)
from services.reports.email_service import EmailService, get_email_service
from core.database import db_manager
from core.portfolio_analyzer import PortfolioAnalyzer

logger = logging.getLogger(__name__)


class ReportService:
    """Service for managing report subscriptions and generation"""

    def __init__(self):
        self.report_generator = get_report_generator()
        self.email_service = get_email_service()
        self.portfolio_analyzer = PortfolioAnalyzer()

    async def _get_subscriptions_collection(self):
        """Get the report_subscriptions collection"""
        db = await db_manager.get_database()
        return db["report_subscriptions"]

    async def _get_history_collection(self):
        """Get the report_history collection"""
        db = await db_manager.get_database()
        return db["report_history"]

    # ==================== Subscription CRUD ====================

    async def get_subscription(self, user_id: str) -> Optional[Dict[str, Any]]:
        """Get user's subscription"""
        try:
            collection = await self._get_subscriptions_collection()
            subscription = await collection.find_one({"user_id": user_id})
            if subscription:
                subscription["id"] = str(subscription.pop("_id"))
                # Convert datetimes to ISO strings
                for key in ["created_at", "updated_at", "next_report_at", "last_report_at", "email_verified_at"]:
                    if subscription.get(key):
                        subscription[key] = subscription[key].isoformat() if isinstance(subscription[key], datetime) else subscription[key]
            return subscription
        except Exception as e:
            logger.error(f"Failed to get subscription for user {user_id}: {e}")
            raise

    async def create_subscription(
        self,
        user_id: str,
        request: CreateSubscriptionRequest
    ) -> Dict[str, Any]:
        """Create a new subscription"""
        try:
            collection = await self._get_subscriptions_collection()

            # Check if subscription already exists
            existing = await collection.find_one({"user_id": user_id})
            if existing:
                raise ValueError("Subscription already exists. Use update instead.")

            # Calculate next report date
            next_report_at = self._calculate_next_report_date(
                frequency=request.frequency,
                preferred_day=request.preferred_day,
                preferred_time_utc=request.preferred_time_utc
            )

            subscription = {
                "user_id": user_id,
                "email_address": request.email_address,
                "email_verified": False,
                "email_verification_token": None,
                "email_verified_at": None,
                "frequency": request.frequency.value,
                "preferred_day": request.preferred_day,
                "preferred_time_utc": request.preferred_time_utc,
                "timezone": request.timezone,
                "portfolio_ids": request.portfolio_ids,
                "include_all_portfolios": request.include_all_portfolios,
                "sections": request.sections.model_dump(),
                "format": request.format.value,
                "include_inline_html": request.include_inline_html,
                "is_active": True,
                "next_report_at": next_report_at,
                "last_report_at": None,
                "total_reports_sent": 0,
                "created_at": datetime.utcnow(),
                "updated_at": datetime.utcnow(),
            }

            result = await collection.insert_one(subscription)
            subscription["id"] = str(result.inserted_id)
            subscription.pop("_id", None)

            logger.info(f"Created report subscription for user {user_id}")
            return subscription
        except Exception as e:
            logger.error(f"Failed to create subscription: {e}")
            raise

    async def update_subscription(
        self,
        user_id: str,
        updates: UpdateSubscriptionRequest
    ) -> bool:
        """Update subscription settings"""
        try:
            collection = await self._get_subscriptions_collection()

            update_dict = {}
            updates_data = updates.model_dump(exclude_unset=True)

            for key, value in updates_data.items():
                if value is not None:
                    if key == "sections":
                        update_dict["sections"] = value.model_dump() if hasattr(value, 'model_dump') else value
                    elif key == "frequency":
                        update_dict["frequency"] = value.value if hasattr(value, 'value') else value
                    elif key == "format":
                        update_dict["format"] = value.value if hasattr(value, 'value') else value
                    else:
                        update_dict[key] = value

            # If email changed, reset verification
            if "email_address" in update_dict:
                update_dict["email_verified"] = False
                update_dict["email_verified_at"] = None

            # If frequency or day changed, recalculate next report date
            if "frequency" in update_dict or "preferred_day" in update_dict or "preferred_time_utc" in update_dict:
                subscription = await collection.find_one({"user_id": user_id})
                if subscription:
                    freq = update_dict.get("frequency", subscription.get("frequency"))
                    day = update_dict.get("preferred_day", subscription.get("preferred_day"))
                    time = update_dict.get("preferred_time_utc", subscription.get("preferred_time_utc"))
                    update_dict["next_report_at"] = self._calculate_next_report_date(
                        frequency=ReportFrequency(freq),
                        preferred_day=day,
                        preferred_time_utc=time
                    )

            update_dict["updated_at"] = datetime.utcnow()

            result = await collection.update_one(
                {"user_id": user_id},
                {"$set": update_dict}
            )

            if result.modified_count > 0:
                logger.info(f"Updated subscription for user {user_id}")
                return True
            return False
        except Exception as e:
            logger.error(f"Failed to update subscription: {e}")
            raise

    async def delete_subscription(self, user_id: str) -> bool:
        """Delete user's subscription"""
        try:
            collection = await self._get_subscriptions_collection()
            result = await collection.delete_one({"user_id": user_id})
            if result.deleted_count > 0:
                logger.info(f"Deleted subscription for user {user_id}")
                return True
            return False
        except Exception as e:
            logger.error(f"Failed to delete subscription: {e}")
            raise

    async def pause_subscription(self, user_id: str) -> bool:
        """Pause subscription (stop sending reports)"""
        try:
            collection = await self._get_subscriptions_collection()
            result = await collection.update_one(
                {"user_id": user_id},
                {"$set": {"is_active": False, "updated_at": datetime.utcnow()}}
            )
            return result.modified_count > 0
        except Exception as e:
            logger.error(f"Failed to pause subscription: {e}")
            raise

    async def resume_subscription(self, user_id: str) -> bool:
        """Resume subscription"""
        try:
            collection = await self._get_subscriptions_collection()
            subscription = await collection.find_one({"user_id": user_id})
            if not subscription:
                return False

            # Recalculate next report date
            next_report_at = self._calculate_next_report_date(
                frequency=ReportFrequency(subscription["frequency"]),
                preferred_day=subscription["preferred_day"],
                preferred_time_utc=subscription["preferred_time_utc"]
            )

            result = await collection.update_one(
                {"user_id": user_id},
                {"$set": {
                    "is_active": True,
                    "next_report_at": next_report_at,
                    "updated_at": datetime.utcnow()
                }}
            )
            return result.modified_count > 0
        except Exception as e:
            logger.error(f"Failed to resume subscription: {e}")
            raise

    # ==================== Email Verification ====================

    async def request_email_verification(
        self,
        user_id: str,
        email_address: str,
        user_name: str,
        verification_base_url: str
    ) -> str:
        """Generate verification token and send email"""
        try:
            collection = await self._get_subscriptions_collection()

            # Generate token
            token = secrets.token_urlsafe(32)

            # Update subscription with token
            await collection.update_one(
                {"user_id": user_id},
                {"$set": {
                    "email_verification_token": token,
                    "updated_at": datetime.utcnow()
                }}
            )

            # Send verification email
            result = await self.email_service.send_verification_email(
                to_email=email_address,
                verification_token=token,
                user_name=user_name,
                verification_url=verification_base_url
            )

            if not result.success:
                raise Exception(f"Failed to send verification email: {result.error}")

            logger.info(f"Sent email verification to {email_address}")
            return token
        except Exception as e:
            logger.error(f"Failed to request email verification: {e}")
            raise

    async def verify_email(self, token: str) -> Dict[str, Any]:
        """Verify email using token"""
        try:
            collection = await self._get_subscriptions_collection()

            subscription = await collection.find_one({"email_verification_token": token})
            if not subscription:
                raise ValueError("Invalid or expired verification token")

            # Mark as verified
            await collection.update_one(
                {"_id": subscription["_id"]},
                {"$set": {
                    "email_verified": True,
                    "email_verified_at": datetime.utcnow(),
                    "email_verification_token": None,
                    "updated_at": datetime.utcnow()
                }}
            )

            logger.info(f"Email verified for user {subscription['user_id']}")
            return {"user_id": subscription["user_id"], "email": subscription["email_address"]}
        except Exception as e:
            logger.error(f"Failed to verify email: {e}")
            raise

    # ==================== Report Generation ====================

    async def generate_and_send_report(
        self,
        subscription_id: str,
        portfolio_data: List[Dict[str, Any]]
    ) -> str:
        """Generate and send a report for a subscription"""
        try:
            subscriptions_col = await self._get_subscriptions_collection()
            history_col = await self._get_history_collection()

            # Get subscription
            subscription = await subscriptions_col.find_one({"_id": ObjectId(subscription_id)})
            if not subscription:
                raise ValueError(f"Subscription {subscription_id} not found")

            # Check if email is verified
            if not subscription.get("email_verified"):
                logger.warning(f"Email not verified for subscription {subscription_id}")
                raise ValueError("Email not verified")

            # Determine report period
            frequency = ReportFrequency(subscription["frequency"])
            period_end = datetime.utcnow()
            period_start = self._get_period_start(frequency, period_end)

            # Create history record
            history_record = {
                "subscription_id": str(subscription_id),
                "user_id": subscription["user_id"],
                "report_period_start": period_start,
                "report_period_end": period_end,
                "frequency": frequency.value,
                "status": ReportStatus.GENERATING.value,
                "error_message": None,
                "email_address": subscription["email_address"],
                "sent_at": None,
                "created_at": datetime.utcnow(),
            }
            history_result = await history_col.insert_one(history_record)
            history_id = str(history_result.inserted_id)

            try:
                # Convert portfolio data to report format
                portfolios_report_data = self._convert_to_report_data(
                    portfolio_data,
                    subscription.get("portfolio_ids", []),
                    subscription.get("include_all_portfolios", True)
                )

                # Generate report
                sections = ReportSections(**subscription.get("sections", {}))
                output_format = ReportFormat(subscription.get("format", "pdf"))

                report_output = self.report_generator.generate_report(
                    portfolios_data=portfolios_report_data,
                    sections=sections,
                    output_format=output_format,
                    report_period_start=period_start,
                    report_period_end=period_end,
                    user_name=subscription.get("user_name", "Investor")
                )

                # Send email
                period_label = self._get_period_label(frequency)
                subject = f"Your {period_label} Vestika Portfolio Report"

                email_result = await self.email_service.send_report_email(
                    to_email=subscription["email_address"],
                    subject=subject,
                    html_body=report_output.html,
                    pdf_attachment=report_output.pdf if output_format == ReportFormat.PDF else None,
                    attachment_filename=f"vestika_report_{period_end.strftime('%Y%m%d')}.pdf"
                )

                if not email_result.success:
                    raise Exception(f"Failed to send email: {email_result.error}")

                # Update history record
                await history_col.update_one(
                    {"_id": ObjectId(history_id)},
                    {"$set": {
                        "status": ReportStatus.SENT.value,
                        "sent_at": datetime.utcnow(),
                        "resend_message_id": email_result.message_id,
                        "sections_generated": report_output.sections_included
                    }}
                )

                # Update subscription
                await subscriptions_col.update_one(
                    {"_id": ObjectId(subscription_id)},
                    {"$set": {
                        "last_report_at": datetime.utcnow(),
                        "next_report_at": self._calculate_next_report_date(
                            frequency=frequency,
                            preferred_day=subscription["preferred_day"],
                            preferred_time_utc=subscription["preferred_time_utc"]
                        ),
                        "updated_at": datetime.utcnow()
                    },
                    "$inc": {"total_reports_sent": 1}}
                )

                logger.info(f"Report sent successfully for subscription {subscription_id}")
                return history_id

            except Exception as gen_error:
                # Update history with error
                await history_col.update_one(
                    {"_id": ObjectId(history_id)},
                    {"$set": {
                        "status": ReportStatus.FAILED.value,
                        "error_message": str(gen_error)
                    }}
                )
                raise

        except Exception as e:
            logger.error(f"Failed to generate/send report: {e}")
            raise

    async def preview_report(
        self,
        user_id: str,
        portfolio_data: List[Dict[str, Any]],
        portfolio_ids: List[str],
        include_all_portfolios: bool,
        sections: ReportSections,
        output_format: ReportFormat
    ) -> Dict[str, Any]:
        """Generate a preview of the report"""
        try:
            portfolios_report_data = self._convert_to_report_data(
                portfolio_data,
                portfolio_ids,
                include_all_portfolios
            )

            now = datetime.utcnow()
            period_start = now - timedelta(days=30)

            report_output = self.report_generator.generate_report(
                portfolios_data=portfolios_report_data,
                sections=sections,
                output_format=output_format,
                report_period_start=period_start,
                report_period_end=now,
                user_name="Investor"
            )

            return {
                "html": report_output.html,
                "pdf": report_output.pdf,
                "sections_included": report_output.sections_included,
                "generation_time_ms": report_output.generation_time_ms
            }
        except Exception as e:
            logger.error(f"Failed to generate preview: {e}")
            raise

    # ==================== Report History ====================

    async def get_report_history(
        self,
        user_id: str,
        limit: int = 20
    ) -> List[Dict[str, Any]]:
        """Get user's report history"""
        try:
            collection = await self._get_history_collection()
            cursor = collection.find(
                {"user_id": user_id}
            ).sort("created_at", -1).limit(limit)

            history = await cursor.to_list(length=limit)
            for item in history:
                item["id"] = str(item.pop("_id"))
                for key in ["created_at", "sent_at", "report_period_start", "report_period_end"]:
                    if item.get(key) and isinstance(item[key], datetime):
                        item[key] = item[key].isoformat()

            return history
        except Exception as e:
            logger.error(f"Failed to get report history: {e}")
            raise

    # ==================== Scheduling ====================

    async def get_due_subscriptions(self, as_of: Optional[datetime] = None) -> List[Dict[str, Any]]:
        """Get subscriptions that are due for report generation"""
        try:
            if as_of is None:
                as_of = datetime.utcnow()

            collection = await self._get_subscriptions_collection()
            cursor = collection.find({
                "is_active": True,
                "email_verified": True,
                "next_report_at": {"$lte": as_of}
            })

            subscriptions = await cursor.to_list(length=100)
            for sub in subscriptions:
                sub["id"] = str(sub.pop("_id"))

            logger.info(f"Found {len(subscriptions)} subscriptions due for reports")
            return subscriptions
        except Exception as e:
            logger.error(f"Failed to get due subscriptions: {e}")
            raise

    # ==================== Helper Methods ====================

    def _calculate_next_report_date(
        self,
        frequency: ReportFrequency,
        preferred_day: int,
        preferred_time_utc: str
    ) -> datetime:
        """Calculate when the next report should be sent"""
        now = datetime.utcnow()
        hour, minute = map(int, preferred_time_utc.split(":"))

        if frequency == ReportFrequency.WEEKLY:
            # preferred_day is 0-6 (Monday-Sunday)
            days_ahead = preferred_day - now.weekday()
            if days_ahead <= 0:  # Target day already passed this week
                days_ahead += 7
            next_date = now + timedelta(days=days_ahead)
            next_date = next_date.replace(hour=hour, minute=minute, second=0, microsecond=0)
            if next_date <= now:
                next_date += timedelta(weeks=1)

        elif frequency == ReportFrequency.MONTHLY:
            # preferred_day is 1-31
            day = min(preferred_day, 28)  # Avoid issues with months having fewer days
            next_date = now.replace(day=day, hour=hour, minute=minute, second=0, microsecond=0)
            if next_date <= now:
                # Move to next month
                if now.month == 12:
                    next_date = next_date.replace(year=now.year + 1, month=1)
                else:
                    next_date = next_date.replace(month=now.month + 1)

        else:  # QUARTERLY
            # preferred_day is day of quarter month (1-31)
            day = min(preferred_day, 28)
            # Quarterly months: Jan(1), Apr(4), Jul(7), Oct(10)
            quarter_months = [1, 4, 7, 10]
            current_quarter = (now.month - 1) // 3
            next_quarter_month = quarter_months[(current_quarter + 1) % 4]
            next_year = now.year if next_quarter_month > now.month else now.year + 1
            next_date = datetime(next_year, next_quarter_month, day, hour, minute)

        return next_date

    def _get_period_start(self, frequency: ReportFrequency, period_end: datetime) -> datetime:
        """Get the start of the reporting period"""
        if frequency == ReportFrequency.WEEKLY:
            return period_end - timedelta(days=7)
        elif frequency == ReportFrequency.MONTHLY:
            return period_end - timedelta(days=30)
        else:  # QUARTERLY
            return period_end - timedelta(days=90)

    def _get_period_label(self, frequency: ReportFrequency) -> str:
        """Get human-readable period label"""
        return {
            ReportFrequency.WEEKLY: "Weekly",
            ReportFrequency.MONTHLY: "Monthly",
            ReportFrequency.QUARTERLY: "Quarterly"
        }.get(frequency, "")

    def _convert_to_report_data(
        self,
        portfolio_data: List[Dict[str, Any]],
        portfolio_ids: List[str],
        include_all_portfolios: bool
    ) -> List[PortfolioReportData]:
        """Convert portfolio data to PortfolioReportData format"""
        result = []

        for portfolio in portfolio_data:
            portfolio_id = portfolio.get("portfolio_id", "")

            # Filter by portfolio_ids if not including all
            if not include_all_portfolios and portfolio_ids:
                if portfolio_id not in portfolio_ids:
                    continue

            # Extract data from portfolio analysis
            analysis = portfolio.get("analysis", {})

            # Build asset allocation list
            asset_allocation = []
            for item in analysis.get("asset_allocation", []):
                asset_allocation.append({
                    "type": item.get("type", "Unknown"),
                    "value": item.get("value", 0),
                    "percentage": item.get("percentage", 0)
                })

            # Build top holdings list
            top_holdings = []
            total_value = analysis.get("total_value", 0)
            for holding in analysis.get("holdings_breakdown", [])[:20]:
                top_holdings.append({
                    "symbol": holding.get("symbol", ""),
                    "name": holding.get("security_name", ""),
                    "value": holding.get("value", 0),
                    "percentage": (holding.get("value", 0) / total_value * 100) if total_value > 0 else 0,
                    "units": holding.get("units", 0)
                })

            # Concentration analysis
            concentration = None
            if analysis.get("concentration_analysis"):
                conc = analysis["concentration_analysis"]
                concentration = {
                    "top_5_percentage": conc.get("top_5_percentage", 0),
                    "top_10_percentage": conc.get("top_10_percentage", 0),
                    "largest_holding_symbol": conc.get("largest_holding", {}).get("symbol", ""),
                    "unique_symbols": conc.get("total_unique_symbols", 0)
                }

            report_data = PortfolioReportData(
                portfolio_name=portfolio.get("portfolio_name", "Portfolio"),
                portfolio_id=portfolio_id,
                base_currency=portfolio.get("base_currency", "USD"),
                total_value=total_value,
                total_holdings=analysis.get("total_holdings", 0),
                accounts_count=analysis.get("total_accounts", 0),
                asset_allocation=asset_allocation,
                top_holdings=top_holdings,
                historical_values=[],  # TODO: Add historical data
                concentration=concentration,
                sector_breakdown=analysis.get("sector_distribution"),
                geographical_breakdown=analysis.get("geographical_distribution"),
                upcoming_vesting=None,  # TODO: Add vesting data
                ai_insights=None  # TODO: Add AI insights
            )
            result.append(report_data)

        return result


# Global singleton
_global_service: Optional[ReportService] = None


def get_report_service() -> ReportService:
    """Get the global report service instance"""
    global _global_service
    if _global_service is None:
        _global_service = ReportService()
    return _global_service
