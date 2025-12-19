"""
Email Service using Resend API.

Follows the TelegramService pattern: graceful degradation when not configured.
If RESEND_API_KEY is not set, email operations are logged but don't fail.
"""

from __future__ import annotations

import logging
from typing import Optional
from dataclasses import dataclass

from config import settings

logger = logging.getLogger(__name__)


@dataclass
class EmailResult:
    """Result of an email send operation"""
    success: bool
    message_id: Optional[str] = None
    error: Optional[str] = None


class EmailService:
    """
    Email service using Resend API.

    Lazily initializes the Resend client with API key from settings.
    If configuration is missing, calls are no-ops with warnings in logs,
    so core flows are not blocked.
    """

    def __init__(self) -> None:
        self._client = None
        self._api_key: Optional[str] = settings.resend_api_key
        self._from_email: str = settings.resend_from_email
        self._from_name: str = settings.resend_from_name
        self._configured: bool = False

    def _ensure_client(self):
        """Lazily initialize the Resend client"""
        if not self._api_key:
            logger.warning("Resend API key not configured; skipping email send")
            return None

        if self._client is None:
            try:
                import resend
                resend.api_key = self._api_key
                self._client = resend
                self._configured = True
                logger.info("Resend email client initialized successfully")
            except ImportError:
                logger.error("resend package not installed; pip install resend")
                return None
            except Exception as e:
                logger.error(f"Failed to initialize Resend client: {e}")
                return None

        return self._client

    @property
    def is_configured(self) -> bool:
        """Check if email service is properly configured"""
        return bool(self._api_key)

    def _get_from_address(self) -> str:
        """Get formatted from address"""
        return f"{self._from_name} <{self._from_email}>"

    async def send_report_email(
        self,
        to_email: str,
        subject: str,
        html_body: str,
        pdf_attachment: Optional[bytes] = None,
        attachment_filename: str = "portfolio_report.pdf"
    ) -> EmailResult:
        """
        Send a portfolio report email.

        Args:
            to_email: Recipient email address
            subject: Email subject line
            html_body: HTML content for the email body
            pdf_attachment: Optional PDF file as bytes
            attachment_filename: Name for the PDF attachment

        Returns:
            EmailResult with success status and message_id or error
        """
        client = self._ensure_client()
        if client is None:
            return EmailResult(
                success=False,
                error="Email service not configured"
            )

        try:
            params = {
                "from": self._get_from_address(),
                "to": [to_email],
                "subject": subject,
                "html": html_body,
            }

            # Add PDF attachment if provided
            if pdf_attachment:
                import base64
                params["attachments"] = [
                    {
                        "filename": attachment_filename,
                        "content": base64.b64encode(pdf_attachment).decode("utf-8"),
                    }
                ]

            # Resend's Python SDK is synchronous, so we call it directly
            response = client.Emails.send(params)

            logger.info(f"Report email sent successfully to {to_email}, id={response.get('id')}")
            return EmailResult(
                success=True,
                message_id=response.get("id")
            )

        except Exception as e:
            logger.error(f"Failed to send report email to {to_email}: {e}")
            return EmailResult(
                success=False,
                error=str(e)
            )

    async def send_verification_email(
        self,
        to_email: str,
        verification_token: str,
        user_name: str,
        verification_url: str
    ) -> EmailResult:
        """
        Send email verification link.

        Args:
            to_email: Email address to verify
            verification_token: Token for verification
            user_name: User's display name
            verification_url: Base URL for verification endpoint

        Returns:
            EmailResult with success status
        """
        client = self._ensure_client()
        if client is None:
            return EmailResult(
                success=False,
                error="Email service not configured"
            )

        subject = "Verify your email for Vestika Reports"

        html_body = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }}
                .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
                .header {{ background: linear-gradient(135deg, #10b981 0%, #3b82f6 100%); padding: 30px; border-radius: 8px 8px 0 0; text-align: center; }}
                .header h1 {{ color: white; margin: 0; font-size: 24px; }}
                .content {{ background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }}
                .button {{ display: inline-block; background: linear-gradient(135deg, #10b981 0%, #3b82f6 100%); color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: 600; margin: 20px 0; }}
                .footer {{ text-align: center; margin-top: 20px; color: #6b7280; font-size: 14px; }}
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>Vestika Reports</h1>
                </div>
                <div class="content">
                    <p>Hi {user_name},</p>
                    <p>Please verify your email address to start receiving portfolio reports from Vestika.</p>
                    <p style="text-align: center;">
                        <a href="{verification_url}?token={verification_token}" class="button">Verify Email</a>
                    </p>
                    <p>Or copy and paste this link into your browser:</p>
                    <p style="word-break: break-all; color: #6b7280; font-size: 14px;">
                        {verification_url}?token={verification_token}
                    </p>
                    <p>This link will expire in 24 hours.</p>
                </div>
                <div class="footer">
                    <p>If you didn't request this, you can safely ignore this email.</p>
                </div>
            </div>
        </body>
        </html>
        """

        try:
            params = {
                "from": self._get_from_address(),
                "to": [to_email],
                "subject": subject,
                "html": html_body,
            }

            response = client.Emails.send(params)

            logger.info(f"Verification email sent to {to_email}, id={response.get('id')}")
            return EmailResult(
                success=True,
                message_id=response.get("id")
            )

        except Exception as e:
            logger.error(f"Failed to send verification email to {to_email}: {e}")
            return EmailResult(
                success=False,
                error=str(e)
            )

    async def send_report_ready_notification(
        self,
        to_email: str,
        user_name: str,
        report_period: str
    ) -> EmailResult:
        """
        Send a simple notification that a report is ready (for users who prefer HTML inline).

        This is a lightweight email without attachments.
        """
        client = self._ensure_client()
        if client is None:
            return EmailResult(
                success=False,
                error="Email service not configured"
            )

        subject = f"Your {report_period} Portfolio Report is Ready"

        html_body = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }}
                .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
                .header {{ background: linear-gradient(135deg, #10b981 0%, #3b82f6 100%); padding: 30px; border-radius: 8px 8px 0 0; text-align: center; }}
                .header h1 {{ color: white; margin: 0; font-size: 24px; }}
                .content {{ background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }}
                .button {{ display: inline-block; background: linear-gradient(135deg, #10b981 0%, #3b82f6 100%); color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: 600; }}
                .footer {{ text-align: center; margin-top: 20px; color: #6b7280; font-size: 14px; }}
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>Portfolio Report Ready</h1>
                </div>
                <div class="content">
                    <p>Hi {user_name},</p>
                    <p>Your {report_period} portfolio report is now available. Log in to Vestika to view your complete analysis.</p>
                    <p style="text-align: center; margin: 30px 0;">
                        <a href="https://app.vestika.io" class="button">View Report</a>
                    </p>
                </div>
                <div class="footer">
                    <p>You're receiving this because you subscribed to portfolio reports.</p>
                    <p>Manage your preferences in Settings.</p>
                </div>
            </div>
        </body>
        </html>
        """

        try:
            params = {
                "from": self._get_from_address(),
                "to": [to_email],
                "subject": subject,
                "html": html_body,
            }

            response = client.Emails.send(params)

            logger.info(f"Report notification sent to {to_email}")
            return EmailResult(
                success=True,
                message_id=response.get("id")
            )

        except Exception as e:
            logger.error(f"Failed to send report notification to {to_email}: {e}")
            return EmailResult(
                success=False,
                error=str(e)
            )


# Global singleton instance
_global_service: Optional[EmailService] = None


def get_email_service() -> EmailService:
    """Get the global email service instance"""
    global _global_service
    if _global_service is None:
        _global_service = EmailService()
    return _global_service
