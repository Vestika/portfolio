"""
Report Subscription Service

This package provides periodic portfolio report generation and delivery:
- Email delivery via Resend
- PDF generation via WeasyPrint
- Chart generation via Matplotlib
- Scheduling via APScheduler
"""

from .email_service import EmailService, get_email_service
from .report_generator import ReportGenerator, get_report_generator

__all__ = [
    "EmailService",
    "get_email_service",
    "ReportGenerator",
    "get_report_generator",
]
