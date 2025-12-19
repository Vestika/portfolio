"""
Chart Generator using Matplotlib.

Generates static chart images for PDF reports.
Mirrors frontend chart styles for consistency.
"""

from __future__ import annotations

import io
import base64
import logging
from typing import List, Dict, Any, Optional
from dataclasses import dataclass

import matplotlib
matplotlib.use('Agg')  # Use non-interactive backend for server-side rendering

import matplotlib.pyplot as plt
import matplotlib.patches as mpatches
from matplotlib.figure import Figure

logger = logging.getLogger(__name__)

# Vestika color palette (matching frontend)
COLORS = [
    '#10b981',  # Emerald (primary)
    '#3b82f6',  # Blue
    '#8b5cf6',  # Purple
    '#f59e0b',  # Amber
    '#ef4444',  # Red
    '#06b6d4',  # Cyan
    '#ec4899',  # Pink
    '#84cc16',  # Lime
    '#f97316',  # Orange
    '#6366f1',  # Indigo
]

# Chart styling
CHART_STYLE = {
    'figure.facecolor': 'white',
    'axes.facecolor': 'white',
    'axes.edgecolor': '#e5e7eb',
    'axes.labelcolor': '#374151',
    'text.color': '#1f2937',
    'xtick.color': '#6b7280',
    'ytick.color': '#6b7280',
    'grid.color': '#f3f4f6',
    'font.family': 'sans-serif',
    'font.size': 10,
}


@dataclass
class ChartOutput:
    """Output of chart generation"""
    png_bytes: bytes
    base64_data: str  # For embedding in HTML
    width: int
    height: int


class ChartGenerator:
    """
    Generates static charts for PDF reports using matplotlib.
    Charts are designed to match the frontend visual style.
    """

    def __init__(self):
        # Apply custom style
        plt.rcParams.update(CHART_STYLE)

    def _get_color(self, index: int) -> str:
        """Get color from palette with wraparound"""
        return COLORS[index % len(COLORS)]

    def _fig_to_output(self, fig: Figure, dpi: int = 150) -> ChartOutput:
        """Convert matplotlib figure to ChartOutput"""
        buf = io.BytesIO()
        fig.savefig(buf, format='png', dpi=dpi, bbox_inches='tight',
                    facecolor='white', edgecolor='none')
        buf.seek(0)
        png_bytes = buf.read()
        base64_data = base64.b64encode(png_bytes).decode('utf-8')

        # Get dimensions
        width = int(fig.get_figwidth() * dpi)
        height = int(fig.get_figheight() * dpi)

        plt.close(fig)

        return ChartOutput(
            png_bytes=png_bytes,
            base64_data=base64_data,
            width=width,
            height=height
        )

    def generate_asset_allocation_pie(
        self,
        allocation_data: List[Dict[str, Any]],
        title: str = "Asset Allocation"
    ) -> Optional[ChartOutput]:
        """
        Generate a pie chart showing asset allocation.

        Args:
            allocation_data: List of {type, value, percentage}
            title: Chart title

        Returns:
            ChartOutput with PNG data
        """
        if not allocation_data:
            return None

        try:
            fig, ax = plt.subplots(figsize=(6, 4))

            # Extract data
            labels = [d.get('type', 'Unknown').capitalize() for d in allocation_data]
            sizes = [d.get('percentage', 0) for d in allocation_data]
            colors = [self._get_color(i) for i in range(len(allocation_data))]

            # Filter out zero values
            filtered = [(l, s, c) for l, s, c in zip(labels, sizes, colors) if s > 0]
            if not filtered:
                plt.close(fig)
                return None

            labels, sizes, colors = zip(*filtered)

            # Create pie chart
            wedges, texts, autotexts = ax.pie(
                sizes,
                labels=None,  # We'll add a legend instead
                colors=colors,
                autopct=lambda pct: f'{pct:.1f}%' if pct > 5 else '',
                pctdistance=0.75,
                startangle=90,
                wedgeprops={'linewidth': 2, 'edgecolor': 'white'}
            )

            # Style percentage labels
            for autotext in autotexts:
                autotext.set_color('white')
                autotext.set_fontsize(9)
                autotext.set_fontweight('bold')

            # Add legend
            ax.legend(
                wedges,
                [f'{l} ({s:.1f}%)' for l, s in zip(labels, sizes)],
                loc='center left',
                bbox_to_anchor=(1, 0.5),
                fontsize=9
            )

            ax.set_title(title, fontsize=12, fontweight='bold', pad=10)

            return self._fig_to_output(fig)

        except Exception as e:
            logger.error(f"Failed to generate pie chart: {e}")
            return None

    def generate_holdings_bar_chart(
        self,
        holdings: List[Dict[str, Any]],
        top_n: int = 10,
        title: str = "Top Holdings",
        currency: str = "USD"
    ) -> Optional[ChartOutput]:
        """
        Generate a horizontal bar chart showing top holdings.

        Args:
            holdings: List of {symbol, name, value, percentage}
            top_n: Number of holdings to show
            title: Chart title
            currency: Currency for value display

        Returns:
            ChartOutput with PNG data
        """
        if not holdings:
            return None

        try:
            # Take top N holdings
            top_holdings = holdings[:top_n]

            fig, ax = plt.subplots(figsize=(7, max(3, len(top_holdings) * 0.4)))

            # Extract data (reverse for horizontal bar chart)
            symbols = [h.get('symbol', 'N/A') for h in reversed(top_holdings)]
            percentages = [h.get('percentage', 0) for h in reversed(top_holdings)]

            # Create horizontal bar chart
            y_pos = range(len(symbols))
            bars = ax.barh(
                y_pos,
                percentages,
                color=[self._get_color(i) for i in range(len(symbols))],
                edgecolor='white',
                linewidth=1
            )

            # Add percentage labels on bars
            for bar, pct in zip(bars, percentages):
                width = bar.get_width()
                label_x = width + 0.5 if width < max(percentages) * 0.8 else width - 2
                color = '#374151' if width < max(percentages) * 0.8 else 'white'
                ax.text(
                    label_x,
                    bar.get_y() + bar.get_height() / 2,
                    f'{pct:.1f}%',
                    va='center',
                    ha='left' if width < max(percentages) * 0.8 else 'right',
                    fontsize=9,
                    color=color,
                    fontweight='bold'
                )

            # Customize axes
            ax.set_yticks(y_pos)
            ax.set_yticklabels(symbols, fontsize=10)
            ax.set_xlabel('Portfolio Weight (%)', fontsize=10)
            ax.set_xlim(0, max(percentages) * 1.15)
            ax.set_title(title, fontsize=12, fontweight='bold', pad=10)

            # Remove top and right spines
            ax.spines['top'].set_visible(False)
            ax.spines['right'].set_visible(False)

            # Add light grid
            ax.xaxis.grid(True, linestyle='--', alpha=0.3)

            plt.tight_layout()

            return self._fig_to_output(fig)

        except Exception as e:
            logger.error(f"Failed to generate bar chart: {e}")
            return None

    def generate_value_line_chart(
        self,
        historical_data: List[Dict[str, Any]],
        title: str = "Portfolio Value",
        currency: str = "USD"
    ) -> Optional[ChartOutput]:
        """
        Generate a line chart showing portfolio value over time.

        Args:
            historical_data: List of {date, value}
            title: Chart title
            currency: Currency for value display

        Returns:
            ChartOutput with PNG data
        """
        if not historical_data or len(historical_data) < 2:
            return None

        try:
            fig, ax = plt.subplots(figsize=(7, 4))

            # Extract data
            dates = [d.get('date', '') for d in historical_data]
            values = [d.get('value', 0) for d in historical_data]

            # Create line chart
            ax.plot(
                dates,
                values,
                color=COLORS[0],
                linewidth=2,
                marker='o',
                markersize=4,
                markerfacecolor='white',
                markeredgecolor=COLORS[0],
                markeredgewidth=2
            )

            # Fill area under line
            ax.fill_between(dates, values, alpha=0.1, color=COLORS[0])

            # Format y-axis as currency
            def format_currency(x, p):
                if x >= 1_000_000:
                    return f'${x/1_000_000:.1f}M'
                elif x >= 1_000:
                    return f'${x/1_000:.0f}K'
                else:
                    return f'${x:.0f}'

            ax.yaxis.set_major_formatter(plt.FuncFormatter(format_currency))

            # Customize axes
            ax.set_xlabel('Date', fontsize=10)
            ax.set_ylabel('Value', fontsize=10)
            ax.set_title(title, fontsize=12, fontweight='bold', pad=10)

            # Rotate x-axis labels
            plt.xticks(rotation=45, ha='right')

            # Remove top and right spines
            ax.spines['top'].set_visible(False)
            ax.spines['right'].set_visible(False)

            # Add grid
            ax.yaxis.grid(True, linestyle='--', alpha=0.3)

            plt.tight_layout()

            return self._fig_to_output(fig)

        except Exception as e:
            logger.error(f"Failed to generate line chart: {e}")
            return None

    def generate_sector_breakdown_chart(
        self,
        sector_data: List[Dict[str, Any]],
        title: str = "Sector Distribution"
    ) -> Optional[ChartOutput]:
        """
        Generate a horizontal bar chart for sector/geographic breakdown.

        Args:
            sector_data: List of {sector/region, value, percentage}
            title: Chart title

        Returns:
            ChartOutput with PNG data
        """
        if not sector_data:
            return None

        try:
            fig, ax = plt.subplots(figsize=(6, max(3, len(sector_data) * 0.35)))

            # Extract data (reverse for horizontal bar chart)
            labels = []
            percentages = []
            for item in reversed(sector_data):
                label = item.get('sector') or item.get('region') or item.get('name', 'Unknown')
                labels.append(label[:20])  # Truncate long labels
                percentages.append(item.get('percentage', 0))

            # Create horizontal bar chart
            y_pos = range(len(labels))
            bars = ax.barh(
                y_pos,
                percentages,
                color=COLORS[1],  # Blue
                edgecolor='white',
                linewidth=1,
                alpha=0.8
            )

            # Add percentage labels
            for bar, pct in zip(bars, percentages):
                ax.text(
                    bar.get_width() + 0.5,
                    bar.get_y() + bar.get_height() / 2,
                    f'{pct:.1f}%',
                    va='center',
                    ha='left',
                    fontsize=9,
                    color='#374151'
                )

            # Customize axes
            ax.set_yticks(y_pos)
            ax.set_yticklabels(labels, fontsize=9)
            ax.set_xlabel('Weight (%)', fontsize=10)
            ax.set_xlim(0, max(percentages) * 1.2 if percentages else 100)
            ax.set_title(title, fontsize=12, fontweight='bold', pad=10)

            # Remove spines
            ax.spines['top'].set_visible(False)
            ax.spines['right'].set_visible(False)

            ax.xaxis.grid(True, linestyle='--', alpha=0.3)

            plt.tight_layout()

            return self._fig_to_output(fig)

        except Exception as e:
            logger.error(f"Failed to generate sector chart: {e}")
            return None

    def generate_concentration_chart(
        self,
        concentration_data: Dict[str, Any],
        title: str = "Portfolio Concentration"
    ) -> Optional[ChartOutput]:
        """
        Generate a chart showing concentration metrics.

        Args:
            concentration_data: {top_5_percentage, top_10_percentage, unique_symbols}
            title: Chart title

        Returns:
            ChartOutput with PNG data
        """
        if not concentration_data:
            return None

        try:
            fig, ax = plt.subplots(figsize=(5, 3))

            metrics = [
                ('Top 5', concentration_data.get('top_5_percentage', 0)),
                ('Top 10', concentration_data.get('top_10_percentage', 0)),
            ]

            labels = [m[0] for m in metrics]
            values = [m[1] for m in metrics]

            # Create bar chart
            bars = ax.bar(
                labels,
                values,
                color=[COLORS[0], COLORS[1]],
                edgecolor='white',
                linewidth=2,
                width=0.6
            )

            # Add value labels on bars
            for bar in bars:
                height = bar.get_height()
                ax.text(
                    bar.get_x() + bar.get_width() / 2,
                    height + 1,
                    f'{height:.1f}%',
                    ha='center',
                    va='bottom',
                    fontsize=11,
                    fontweight='bold',
                    color='#374151'
                )

            # Customize axes
            ax.set_ylabel('Portfolio Weight (%)', fontsize=10)
            ax.set_ylim(0, max(values) * 1.2 if values else 100)
            ax.set_title(title, fontsize=12, fontweight='bold', pad=10)

            # Remove spines
            ax.spines['top'].set_visible(False)
            ax.spines['right'].set_visible(False)

            ax.yaxis.grid(True, linestyle='--', alpha=0.3)

            plt.tight_layout()

            return self._fig_to_output(fig)

        except Exception as e:
            logger.error(f"Failed to generate concentration chart: {e}")
            return None


# Global singleton
_global_generator: Optional[ChartGenerator] = None


def get_chart_generator() -> ChartGenerator:
    """Get the global chart generator instance"""
    global _global_generator
    if _global_generator is None:
        _global_generator = ChartGenerator()
    return _global_generator
