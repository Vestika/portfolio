"""
Report Generator using WeasyPrint for PDF generation.

Generates HTML reports from portfolio data and converts them to PDF.
Uses Jinja2 templates for flexible report formatting.
"""

from __future__ import annotations

import logging
from typing import Optional, Dict, Any, List
from datetime import datetime, timedelta
from pathlib import Path
from dataclasses import dataclass
import io

from jinja2 import Environment, FileSystemLoader

from models.report_models import ReportSections, ReportFormat

logger = logging.getLogger(__name__)

# Path to templates directory
TEMPLATES_DIR = Path(__file__).parent / "templates"


@dataclass
class ReportOutput:
    """Result of report generation"""
    html: str
    pdf: Optional[bytes] = None
    sections_included: List[str] = None
    generation_time_ms: int = 0

    def __post_init__(self):
        if self.sections_included is None:
            self.sections_included = []


@dataclass
class PortfolioReportData:
    """Aggregated data for report generation"""
    # Portfolio info
    portfolio_name: str
    portfolio_id: str
    base_currency: str

    # Summary
    total_value: float
    total_holdings: int
    accounts_count: int

    # Asset allocation
    asset_allocation: List[Dict[str, Any]]  # [{type, value, percentage}]

    # Top holdings
    top_holdings: List[Dict[str, Any]]  # [{symbol, name, value, percentage, units}]

    # Historical values (for performance chart)
    historical_values: List[Dict[str, Any]]  # [{date, value}]

    # Concentration metrics
    concentration: Optional[Dict[str, Any]] = None

    # Sector/Geo breakdown
    sector_breakdown: Optional[List[Dict[str, Any]]] = None
    geographical_breakdown: Optional[List[Dict[str, Any]]] = None

    # Options/RSU vesting
    upcoming_vesting: Optional[List[Dict[str, Any]]] = None

    # AI insights
    ai_insights: Optional[str] = None


class ReportGenerator:
    """
    Generates portfolio reports in HTML and PDF formats.

    Uses:
    - Jinja2 for HTML templating
    - WeasyPrint for PDF conversion
    - Matplotlib for chart generation (optional)
    """

    def __init__(self):
        self._jinja_env: Optional[Environment] = None
        self._weasyprint_available: bool = False
        self._check_dependencies()

    def _check_dependencies(self):
        """Check if optional dependencies are available"""
        try:
            import weasyprint
            self._weasyprint_available = True
            logger.info("WeasyPrint is available for PDF generation")
        except ImportError:
            self._weasyprint_available = False
            logger.warning("WeasyPrint not available; PDF generation disabled")

    def _get_jinja_env(self) -> Environment:
        """Get or create Jinja2 environment"""
        if self._jinja_env is None:
            self._jinja_env = Environment(
                loader=FileSystemLoader(str(TEMPLATES_DIR)),
                autoescape=True
            )
            # Add custom filters
            self._jinja_env.filters["format_currency"] = self._format_currency
            self._jinja_env.filters["format_percentage"] = self._format_percentage
            self._jinja_env.filters["format_number"] = self._format_number
            self._jinja_env.filters["format_date"] = self._format_date

        return self._jinja_env

    @staticmethod
    def _format_currency(value: float, currency: str = "USD") -> str:
        """Format a number as currency"""
        if currency == "USD":
            return f"${value:,.2f}"
        elif currency == "EUR":
            return f"\u20ac{value:,.2f}"
        elif currency == "GBP":
            return f"\u00a3{value:,.2f}"
        elif currency == "ILS":
            return f"\u20aa{value:,.2f}"
        else:
            return f"{currency} {value:,.2f}"

    @staticmethod
    def _format_percentage(value: float) -> str:
        """Format a number as percentage"""
        return f"{value:.1f}%"

    @staticmethod
    def _format_number(value: float) -> str:
        """Format a number with commas"""
        return f"{value:,.2f}"

    @staticmethod
    def _format_date(value: datetime) -> str:
        """Format a datetime"""
        if isinstance(value, str):
            return value
        return value.strftime("%b %d, %Y")

    def generate_report(
        self,
        portfolios_data: List[PortfolioReportData],
        sections: ReportSections,
        output_format: ReportFormat,
        report_period_start: datetime,
        report_period_end: datetime,
        user_name: str = "Investor"
    ) -> ReportOutput:
        """
        Generate a portfolio report.

        Args:
            portfolios_data: List of portfolio data to include
            sections: Which sections to include
            output_format: PDF or HTML
            report_period_start: Start of reporting period
            report_period_end: End of reporting period
            user_name: User's display name

        Returns:
            ReportOutput with HTML and optionally PDF
        """
        start_time = datetime.utcnow()

        # Determine which sections to include
        sections_included = self._get_enabled_sections(sections)

        # Build template context
        context = self._build_template_context(
            portfolios_data=portfolios_data,
            sections=sections,
            sections_included=sections_included,
            report_period_start=report_period_start,
            report_period_end=report_period_end,
            user_name=user_name
        )

        # Render HTML
        env = self._get_jinja_env()
        template = env.get_template("report_base.html")
        html = template.render(**context)

        # Convert to PDF if requested
        pdf = None
        if output_format == ReportFormat.PDF and self._weasyprint_available:
            pdf = self._convert_to_pdf(html)

        generation_time = int((datetime.utcnow() - start_time).total_seconds() * 1000)

        return ReportOutput(
            html=html,
            pdf=pdf,
            sections_included=sections_included,
            generation_time_ms=generation_time
        )

    def _get_enabled_sections(self, sections: ReportSections) -> List[str]:
        """Get list of enabled section names"""
        enabled = []
        section_dict = sections.model_dump()
        for key, value in section_dict.items():
            if value:
                enabled.append(key)
        return enabled

    def _build_template_context(
        self,
        portfolios_data: List[PortfolioReportData],
        sections: ReportSections,
        sections_included: List[str],
        report_period_start: datetime,
        report_period_end: datetime,
        user_name: str
    ) -> Dict[str, Any]:
        """Build the template context dictionary"""

        # Aggregate totals across all portfolios
        total_value = sum(p.total_value for p in portfolios_data)
        total_holdings = sum(p.total_holdings for p in portfolios_data)

        # Determine report period label
        days_diff = (report_period_end - report_period_start).days
        if days_diff <= 7:
            period_label = "Weekly"
        elif days_diff <= 31:
            period_label = "Monthly"
        else:
            period_label = "Quarterly"

        # Get primary currency (from first portfolio)
        base_currency = portfolios_data[0].base_currency if portfolios_data else "USD"

        return {
            # Meta
            "report_title": f"{period_label} Portfolio Report",
            "user_name": user_name,
            "report_date": datetime.utcnow(),
            "period_start": report_period_start,
            "period_end": report_period_end,
            "period_label": period_label,

            # Sections config
            "sections": sections,
            "sections_included": sections_included,

            # Portfolio data
            "portfolios": portfolios_data,
            "portfolios_count": len(portfolios_data),

            # Aggregated totals
            "total_value": total_value,
            "total_holdings": total_holdings,
            "base_currency": base_currency,

            # Generation info
            "generated_at": datetime.utcnow(),
            "app_url": "https://app.vestika.io",
        }

    def _convert_to_pdf(self, html: str) -> Optional[bytes]:
        """Convert HTML to PDF using WeasyPrint"""
        if not self._weasyprint_available:
            return None

        try:
            from weasyprint import HTML, CSS

            # Read CSS file if it exists
            css_path = TEMPLATES_DIR / "styles.css"
            stylesheets = []
            if css_path.exists():
                stylesheets.append(CSS(filename=str(css_path)))

            # Generate PDF
            html_doc = HTML(string=html, base_url=str(TEMPLATES_DIR))
            pdf_bytes = html_doc.write_pdf(stylesheets=stylesheets)

            logger.info(f"PDF generated successfully, size={len(pdf_bytes)} bytes")
            return pdf_bytes

        except Exception as e:
            logger.error(f"Failed to generate PDF: {e}")
            return None

    def generate_preview(
        self,
        portfolios_data: List[PortfolioReportData],
        sections: ReportSections,
        user_name: str = "Investor"
    ) -> str:
        """
        Generate a quick HTML preview of the report.

        Uses current date as the report period.
        """
        now = datetime.utcnow()
        period_start = now - timedelta(days=30)

        result = self.generate_report(
            portfolios_data=portfolios_data,
            sections=sections,
            output_format=ReportFormat.HTML,
            report_period_start=period_start,
            report_period_end=now,
            user_name=user_name
        )

        return result.html


# Global singleton
_global_generator: Optional[ReportGenerator] = None


def get_report_generator() -> ReportGenerator:
    """Get the global report generator instance"""
    global _global_generator
    if _global_generator is None:
        _global_generator = ReportGenerator()
    return _global_generator
