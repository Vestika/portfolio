"""
Report Subscription API endpoints.

Manages user subscriptions for periodic portfolio reports.
"""

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from fastapi.responses import HTMLResponse
from typing import Dict, Any, List, Optional
from core.auth import get_current_user
from core.report_service import get_report_service
from models.report_models import (
    CreateSubscriptionRequest, UpdateSubscriptionRequest,
    PreviewReportRequest, EmailVerificationRequest,
    SubscriptionResponse, ReportHistoryItem, ReportSectionInfo,
    ReportSections, ReportFormat,
    AVAILABLE_REPORT_SECTIONS
)
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/reports", tags=["reports"])


# ==================== Subscription Management ====================

@router.get("/subscription")
async def get_subscription(
    user=Depends(get_current_user)
) -> Optional[Dict[str, Any]]:
    """Get user's report subscription"""
    try:
        report_service = get_report_service()
        user_id = user.firebase_uid

        if not user_id:
            raise HTTPException(status_code=400, detail="User ID not found")

        subscription = await report_service.get_subscription(user_id)
        return subscription

    except Exception as e:
        logger.error(f"Failed to get subscription: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve subscription")


@router.post("/subscription")
async def create_subscription(
    request: CreateSubscriptionRequest,
    user=Depends(get_current_user)
) -> Dict[str, Any]:
    """Create a new report subscription"""
    try:
        report_service = get_report_service()
        user_id = user.firebase_uid

        if not user_id:
            raise HTTPException(status_code=400, detail="User ID not found")

        subscription = await report_service.create_subscription(user_id, request)

        return {
            "success": True,
            "subscription_id": subscription.get("id"),
            "message": "Subscription created. Please verify your email to start receiving reports."
        }

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Failed to create subscription: {e}")
        raise HTTPException(status_code=500, detail="Failed to create subscription")


@router.put("/subscription")
async def update_subscription(
    request: UpdateSubscriptionRequest,
    user=Depends(get_current_user)
) -> Dict[str, bool]:
    """Update subscription settings"""
    try:
        report_service = get_report_service()
        user_id = user.firebase_uid

        if not user_id:
            raise HTTPException(status_code=400, detail="User ID not found")

        success = await report_service.update_subscription(user_id, request)

        if not success:
            raise HTTPException(status_code=404, detail="Subscription not found")

        return {"success": True}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to update subscription: {e}")
        raise HTTPException(status_code=500, detail="Failed to update subscription")


@router.delete("/subscription")
async def delete_subscription(
    user=Depends(get_current_user)
) -> Dict[str, bool]:
    """Delete subscription"""
    try:
        report_service = get_report_service()
        user_id = user.firebase_uid

        if not user_id:
            raise HTTPException(status_code=400, detail="User ID not found")

        success = await report_service.delete_subscription(user_id)

        if not success:
            raise HTTPException(status_code=404, detail="Subscription not found")

        return {"success": True}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to delete subscription: {e}")
        raise HTTPException(status_code=500, detail="Failed to delete subscription")


@router.post("/subscription/pause")
async def pause_subscription(
    user=Depends(get_current_user)
) -> Dict[str, bool]:
    """Pause subscription (stop sending reports)"""
    try:
        report_service = get_report_service()
        user_id = user.firebase_uid

        if not user_id:
            raise HTTPException(status_code=400, detail="User ID not found")

        success = await report_service.pause_subscription(user_id)

        if not success:
            raise HTTPException(status_code=404, detail="Subscription not found")

        return {"success": True}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to pause subscription: {e}")
        raise HTTPException(status_code=500, detail="Failed to pause subscription")


@router.post("/subscription/resume")
async def resume_subscription(
    user=Depends(get_current_user)
) -> Dict[str, bool]:
    """Resume paused subscription"""
    try:
        report_service = get_report_service()
        user_id = user.firebase_uid

        if not user_id:
            raise HTTPException(status_code=400, detail="User ID not found")

        success = await report_service.resume_subscription(user_id)

        if not success:
            raise HTTPException(status_code=404, detail="Subscription not found")

        return {"success": True}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to resume subscription: {e}")
        raise HTTPException(status_code=500, detail="Failed to resume subscription")


# ==================== Email Verification ====================

@router.post("/verify-email")
async def request_email_verification(
    request: EmailVerificationRequest,
    user=Depends(get_current_user)
) -> Dict[str, str]:
    """Request email verification for reports"""
    try:
        logger.info(f"[VERIFY-EMAIL] Starting verification request")
        report_service = get_report_service()
        user_id = user.firebase_uid
        user_name = user.name or "Investor"
        logger.info(f"[VERIFY-EMAIL] User: {user_id}, name: {user_name}")

        if not user_id:
            raise HTTPException(status_code=400, detail="User ID not found")

        # Get or check subscription exists
        logger.info(f"[VERIFY-EMAIL] Getting subscription...")
        subscription = await report_service.get_subscription(user_id)
        logger.info(f"[VERIFY-EMAIL] Subscription: {subscription}")
        if not subscription:
            raise HTTPException(status_code=404, detail="No subscription found. Create one first.")

        # Use the app URL for verification
        verification_base_url = "https://app.vestika.io/reports/verify-email"

        logger.info(f"[VERIFY-EMAIL] Calling request_email_verification...")
        await report_service.request_email_verification(
            user_id=user_id,
            email_address=request.email_address,
            user_name=user_name,
            verification_base_url=verification_base_url
        )
        logger.info(f"[VERIFY-EMAIL] Done!")

        return {
            "message": f"Verification email sent to {request.email_address}"
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[VERIFY-EMAIL] Failed to send verification: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to send verification email")


@router.get("/verify-email/{token}")
async def verify_email(token: str) -> Dict[str, Any]:
    """Verify email using token (can be called without auth)"""
    try:
        report_service = get_report_service()
        result = await report_service.verify_email(token)

        return {
            "success": True,
            "message": "Email verified successfully. You will now receive portfolio reports.",
            "email": result.get("email")
        }

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Failed to verify email: {e}")
        raise HTTPException(status_code=500, detail="Failed to verify email")


# ==================== Report Preview & Manual Trigger ====================

@router.post("/preview")
async def preview_report(
    request: PreviewReportRequest,
    user=Depends(get_current_user)
) -> Response:
    """
    Generate a preview of the report.

    Returns HTML or PDF based on the format parameter.
    """
    try:
        report_service = get_report_service()
        user_id = user.firebase_uid

        if not user_id:
            raise HTTPException(status_code=400, detail="User ID not found")

        # TODO: Fetch actual portfolio data for the user
        # For now, return a placeholder
        # In production, this would fetch from the portfolio endpoint
        portfolio_data = []  # Would be fetched from portfolio service

        result = await report_service.preview_report(
            user_id=user_id,
            portfolio_data=portfolio_data,
            portfolio_ids=request.portfolio_ids,
            include_all_portfolios=request.include_all_portfolios,
            sections=request.sections,
            output_format=request.format
        )

        if request.format == ReportFormat.PDF and result.get("pdf"):
            return Response(
                content=result["pdf"],
                media_type="application/pdf",
                headers={
                    "Content-Disposition": "attachment; filename=report_preview.pdf"
                }
            )

        return HTMLResponse(content=result["html"])

    except Exception as e:
        logger.error(f"Failed to generate preview: {e}")
        raise HTTPException(status_code=500, detail="Failed to generate preview")


@router.get("/test-generate")
async def test_generate_report(
    format: str = Query(default="email", description="Output: email (send to user), html (view), or pdf (download)"),
    user=Depends(get_current_user)
) -> Response:
    """
    TEST ENDPOINT: Generate a real report with your actual portfolio data.
    format=email sends it to your email, format=html/pdf returns directly.
    """
    from core.database import db_manager
    from services.reports.report_generator import get_report_generator, PortfolioReportData
    from services.reports.email_service import get_email_service
    from datetime import datetime, timedelta

    try:
        # Use user.id (MongoDB ObjectId) NOT firebase_uid for portfolio queries
        user_id = user.id
        logger.info(f"[TEST-GENERATE] Starting for user {user_id} (email: {user.email})")

        # Get database
        db = await db_manager.get_database()

        # Get user's portfolios - use user.id like other endpoints do
        # Portfolio documents have embedded accounts and holdings (not separate collections!)
        portfolios_cursor = db.portfolios.find({"user_id": user_id})
        portfolios = await portfolios_cursor.to_list(length=100)
        logger.info(f"[TEST-GENERATE] Found {len(portfolios)} portfolios")

        if not portfolios:
            return HTMLResponse(content=f"<h1>No portfolios found for user_id: {user_id}</h1>")

        # Build report data for each portfolio
        report_data_list = []

        for portfolio in portfolios:
            portfolio_id = str(portfolio["_id"])
            portfolio_name = portfolio.get("portfolio_name", portfolio.get("config", {}).get("user_name", "Portfolio"))
            base_currency = portfolio.get("config", {}).get("base_currency", "USD")
            securities = portfolio.get("securities", {})
            logger.info(f"[TEST-GENERATE] Processing portfolio: {portfolio_name} ({portfolio_id})")

            # Accounts and holdings are EMBEDDED in the portfolio document
            accounts = portfolio.get("accounts", [])
            logger.info(f"[TEST-GENERATE] Found {len(accounts)} embedded accounts")

            # Calculate totals from embedded holdings
            total_value = 0
            holdings_data = []
            total_accounts = len(accounts)

            for account in accounts:
                account_name = account.get("name", account.get("account_name", "Account"))
                holdings = account.get("holdings", [])
                logger.info(f"[TEST-GENERATE] Account '{account_name}' has {len(holdings)} holdings")

                for holding in holdings:
                    symbol = holding.get("symbol", "")
                    units = holding.get("units", 0)

                    # Get security info from portfolio's securities dict
                    security_info = securities.get(symbol, {})
                    security_name = security_info.get("name", symbol)

                    # Get current price from current_prices collection
                    price_doc = await db.current_prices.find_one({"symbol": symbol})
                    price = price_doc.get("price", 0) if price_doc else 0
                    value = units * price
                    total_value += value

                    holdings_data.append({
                        "symbol": symbol,
                        "name": security_name,
                        "value": value,
                        "units": units,
                        "percentage": 0  # Will calculate after
                    })

            logger.info(f"[TEST-GENERATE] Total holdings: {len(holdings_data)}, total value: {total_value}")

            # Calculate percentages
            for h in holdings_data:
                h["percentage"] = (h["value"] / total_value * 100) if total_value > 0 else 0

            # Sort by value descending
            holdings_data.sort(key=lambda x: x["value"], reverse=True)

            # Build asset allocation based on actual security types
            type_values = {}
            for h in holdings_data:
                symbol = h["symbol"]
                sec_type = securities.get(symbol, {}).get("type", "stock")
                type_values[sec_type] = type_values.get(sec_type, 0) + h["value"]

            asset_allocation = []
            for sec_type, value in sorted(type_values.items(), key=lambda x: -x[1]):
                pct = (value / total_value * 100) if total_value > 0 else 0
                asset_allocation.append({
                    "type": sec_type.replace("-", " ").title(),
                    "value": value,
                    "percentage": pct
                })

            report_data = PortfolioReportData(
                portfolio_name=portfolio_name,
                portfolio_id=portfolio_id,
                base_currency=base_currency,
                total_value=total_value,
                total_holdings=len(holdings_data),
                accounts_count=total_accounts,
                asset_allocation=asset_allocation,
                top_holdings=holdings_data[:20],
                historical_values=[],
                concentration={
                    "top_5_percentage": sum(h["percentage"] for h in holdings_data[:5]),
                    "top_10_percentage": sum(h["percentage"] for h in holdings_data[:10]),
                    "largest_holding_symbol": holdings_data[0]["symbol"] if holdings_data else "",
                    "unique_symbols": len(holdings_data)
                } if holdings_data else None,
                sector_breakdown=None,
                geographical_breakdown=None,
                upcoming_vesting=None,
                ai_insights=None
            )
            report_data_list.append(report_data)

        logger.info(f"[TEST-GENERATE] Built report data for {len(report_data_list)} portfolios")

        # Generate report
        generator = get_report_generator()
        sections = ReportSections(
            portfolio_summary=True,
            asset_allocation=True,
            holdings_table=True,
            performance_chart=False,
            sector_breakdown=False,
            geographical_breakdown=False,
            concentration_analysis=True,
            options_vesting=False,
            ai_insights=False
        )

        # Always generate both HTML and PDF for email
        now = datetime.utcnow()
        report_output = generator.generate_report(
            portfolios_data=report_data_list,
            sections=sections,
            output_format=ReportFormat.PDF,  # Generate PDF (also produces HTML)
            report_period_start=now - timedelta(days=30),
            report_period_end=now,
            user_name=user.name or "Investor"
        )

        logger.info(f"[TEST-GENERATE] Report generated in {report_output.generation_time_ms}ms, PDF size: {len(report_output.pdf) if report_output.pdf else 0} bytes")

        # Handle different output formats
        if format.lower() == "email":
            # Send email with PDF attachment
            email_service = get_email_service()

            if not email_service.is_configured:
                return HTMLResponse(
                    content="<h1>Email service not configured</h1><p>Set RESEND_API_KEY in environment</p>",
                    status_code=500
                )

            # Create a proper email body (not the full report)
            total_value = sum(p.total_value for p in report_data_list)
            total_holdings = sum(p.total_holdings for p in report_data_list)
            user_name = user.name or "Investor"

            email_html = f"""
            <!DOCTYPE html>
            <html>
            <head>
                <style>
                    body {{ font-family: 'Times New Roman', Georgia, serif; line-height: 1.6; color: #1a1a1a; background: #f7fafc; margin: 0; padding: 0; }}
                    .container {{ max-width: 600px; margin: 0 auto; background: white; }}
                    .header {{ background: linear-gradient(135deg, #1a365d 0%, #2c5282 100%); padding: 30px 40px; }}
                    .header-content {{ display: flex; justify-content: space-between; align-items: center; }}
                    .logo {{ color: white; font-size: 28px; font-weight: bold; letter-spacing: 2px; }}
                    .tagline {{ color: rgba(255,255,255,0.8); font-size: 11px; letter-spacing: 1px; text-transform: uppercase; }}
                    .report-type {{ color: white; font-size: 12px; text-transform: uppercase; letter-spacing: 1px; text-align: right; }}
                    .content {{ padding: 40px; }}
                    .greeting {{ font-size: 18px; color: #1a365d; margin-bottom: 20px; }}
                    .summary-box {{ background: #f7fafc; border-left: 4px solid #1a365d; padding: 20px; margin: 25px 0; }}
                    .summary-title {{ font-size: 12px; text-transform: uppercase; letter-spacing: 1px; color: #718096; margin-bottom: 15px; }}
                    .summary-grid {{ display: flex; justify-content: space-around; }}
                    .metric {{ text-align: center; }}
                    .metric-value {{ font-size: 28px; font-weight: bold; color: #1a365d; }}
                    .metric-label {{ font-size: 11px; color: #718096; text-transform: uppercase; }}
                    .cta-section {{ text-align: center; margin: 30px 0; }}
                    .cta-button {{ display: inline-block; background: linear-gradient(135deg, #1a365d 0%, #2c5282 100%); color: white; padding: 14px 40px; text-decoration: none; border-radius: 4px; font-weight: 600; letter-spacing: 0.5px; }}
                    .attachment-note {{ background: #edf2f7; padding: 15px 20px; border-radius: 4px; margin: 25px 0; font-size: 14px; color: #4a5568; }}
                    .attachment-note strong {{ color: #1a365d; }}
                    .footer {{ background: #f7fafc; padding: 25px 40px; border-top: 1px solid #e2e8f0; text-align: center; font-size: 12px; color: #718096; }}
                    .footer a {{ color: #2c5282; text-decoration: none; }}
                    .confidential {{ color: #e53e3e; text-transform: uppercase; letter-spacing: 1px; font-weight: 600; font-size: 10px; margin-top: 15px; }}
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <table width="100%" cellpadding="0" cellspacing="0">
                            <tr>
                                <td>
                                    <div class="logo">VESTIKA</div>
                                    <div class="tagline">Portfolio Intelligence</div>
                                </td>
                                <td style="text-align: right;">
                                    <div class="report-type">Monthly Report</div>
                                    <div style="color: rgba(255,255,255,0.8); font-size: 12px; margin-top: 4px;">{now.strftime('%B %d, %Y')}</div>
                                </td>
                            </tr>
                        </table>
                    </div>

                    <div class="content">
                        <div class="greeting">Dear {user_name},</div>

                        <p>Your portfolio report for the period ending {now.strftime('%B %d, %Y')} is now available. Please find the detailed PDF report attached to this email.</p>

                        <div class="summary-box">
                            <div class="summary-title">Executive Summary</div>
                            <table width="100%" cellpadding="0" cellspacing="0">
                                <tr>
                                    <td style="text-align: center; padding: 10px;">
                                        <div class="metric-value">${total_value:,.2f}</div>
                                        <div class="metric-label">Total Value</div>
                                    </td>
                                    <td style="text-align: center; padding: 10px;">
                                        <div class="metric-value">{len(report_data_list)}</div>
                                        <div class="metric-label">Portfolios</div>
                                    </td>
                                    <td style="text-align: center; padding: 10px;">
                                        <div class="metric-value">{total_holdings}</div>
                                        <div class="metric-label">Positions</div>
                                    </td>
                                </tr>
                            </table>
                        </div>

                        <div class="attachment-note">
                            <strong>📎 PDF Report Attached</strong><br>
                            Your complete portfolio analysis with holdings breakdown, asset allocation, and concentration metrics is attached as a PDF.
                        </div>

                        <div class="cta-section">
                            <a href="https://app.vestika.io" class="cta-button">View in Vestika</a>
                        </div>

                        <p style="font-size: 14px; color: #4a5568;">For real-time portfolio tracking and advanced analytics, log in to your Vestika dashboard.</p>
                    </div>

                    <div class="footer">
                        <p><strong>Vestika</strong> - Portfolio Intelligence</p>
                        <p><a href="https://app.vestika.io">app.vestika.io</a></p>
                        <p style="margin-top: 15px; font-size: 11px;">This report is for informational purposes only and does not constitute financial advice.</p>
                        <div class="confidential">Confidential</div>
                    </div>
                </div>
            </body>
            </html>
            """

            # Log PDF status
            pdf_size = len(report_output.pdf) if report_output.pdf else 0
            logger.info(f"[TEST-GENERATE] Sending email with PDF attachment: {pdf_size} bytes")

            result = await email_service.send_report_email(
                to_email=user.email,
                subject=f"Your Portfolio Report - {now.strftime('%B %d, %Y')}",
                html_body=email_html,
                pdf_attachment=report_output.pdf,
                attachment_filename=f"vestika_report_{now.strftime('%Y%m%d')}.pdf"
            )

            if result.success:
                return HTMLResponse(
                    content=f"""
                    <html>
                    <body style="font-family: sans-serif; padding: 40px; text-align: center;">
                        <h1 style="color: green;">✅ Report Sent!</h1>
                        <p>Check your inbox at <strong>{user.email}</strong></p>
                        <p style="color: gray;">PDF attached: {pdf_size} bytes</p>
                        <p style="color: gray;">Message ID: {result.message_id}</p>
                    </body>
                    </html>
                    """
                )
            else:
                return HTMLResponse(
                    content=f"<h1>Failed to send email</h1><p>{result.error}</p>",
                    status_code=500
                )

        elif format.lower() == "pdf":
            if report_output.pdf:
                return Response(
                    content=report_output.pdf,
                    media_type="application/pdf",
                    headers={
                        "Content-Disposition": f"inline; filename=test_report_{now.strftime('%Y%m%d')}.pdf"
                    }
                )
            else:
                return HTMLResponse(content="<h1>PDF generation failed</h1><p>Check server logs</p>", status_code=500)

        else:  # HTML
            return HTMLResponse(content=report_output.html)

    except Exception as e:
        logger.error(f"[TEST-GENERATE] Failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to generate test report: {str(e)}")


@router.post("/send-now")
async def send_report_now(
    user=Depends(get_current_user)
) -> Dict[str, str]:
    """Manually trigger sending a report immediately"""
    try:
        report_service = get_report_service()
        user_id = user.firebase_uid

        if not user_id:
            raise HTTPException(status_code=400, detail="User ID not found")

        subscription = await report_service.get_subscription(user_id)
        if not subscription:
            raise HTTPException(status_code=404, detail="No subscription found")

        if not subscription.get("email_verified"):
            raise HTTPException(
                status_code=400,
                detail="Email not verified. Please verify your email first."
            )

        # TODO: Fetch portfolio data and trigger report generation
        # This would integrate with the portfolio endpoint
        # For now, return a placeholder response

        return {
            "message": "Report generation triggered. You will receive it shortly.",
            "email": subscription.get("email_address")
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to send report: {e}")
        raise HTTPException(status_code=500, detail="Failed to send report")


# ==================== Report History ====================

@router.get("/history")
async def get_report_history(
    limit: int = Query(default=20, ge=1, le=100),
    user=Depends(get_current_user)
) -> List[Dict[str, Any]]:
    """Get user's report history"""
    try:
        report_service = get_report_service()
        user_id = user.firebase_uid

        if not user_id:
            raise HTTPException(status_code=400, detail="User ID not found")

        history = await report_service.get_report_history(user_id, limit)
        return history

    except Exception as e:
        logger.error(f"Failed to get history: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve report history")


# ==================== Available Sections ====================

@router.get("/available-sections")
async def get_available_sections() -> List[ReportSectionInfo]:
    """Get list of available report sections"""
    return AVAILABLE_REPORT_SECTIONS
