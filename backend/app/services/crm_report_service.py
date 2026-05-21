"""
CRM report PDF export using fpdf2.
"""
from __future__ import annotations

from datetime import date
from io import BytesIO
from typing import Optional

from fpdf import FPDF

from app.models.crm import DashboardMetrics
from app.models.sales_pipeline import PipelineForecast, PipelineInsights
from app.services.crm_service import get_dashboard_metrics
from app.services.sales_pipeline_service import (
    generate_pipeline_insights,
    get_pipeline_forecast,
)


def _safe_text(value: object) -> str:
    text = str(value or "")
    return text.encode("latin-1", errors="replace").decode("latin-1")


def _money(value: float) -> str:
    if value >= 1_000_000:
        return f"${value / 1_000_000:.2f}M"
    if value >= 1_000:
        return f"${value / 1_000:.1f}k"
    return f"${value:,.0f}"


class _CRMReportPDF(FPDF):
    def header(self) -> None:
        self.set_font("Helvetica", "B", 14)
        self.cell(0, 10, "LeanChem CRM Report", new_x="LMARGIN", new_y="NEXT", align="C")
        self.set_font("Helvetica", "", 9)
        self.cell(0, 6, f"Generated {date.today().isoformat()}", new_x="LMARGIN", new_y="NEXT", align="C")
        self.ln(4)

    def section_title(self, title: str) -> None:
        self.set_font("Helvetica", "B", 11)
        self.cell(0, 8, _safe_text(title), new_x="LMARGIN", new_y="NEXT")
        self.set_font("Helvetica", "", 10)

    def bullet_line(self, label: str, value: str) -> None:
        self.cell(95, 6, _safe_text(label))
        self.cell(0, 6, _safe_text(value), new_x="LMARGIN", new_y="NEXT")


def build_crm_report_pdf(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    days_back: int = 90,
    forecast_days: int = 30,
) -> bytes:
    metrics = get_dashboard_metrics(start_date=start_date, end_date=end_date)
    insights = generate_pipeline_insights(days_back=days_back)
    forecast = get_pipeline_forecast(days_ahead=forecast_days)

    pdf = _CRMReportPDF()
    pdf.set_auto_page_break(auto=True, margin=15)
    pdf.add_page()

    range_label = "All time"
    if start_date or end_date:
        range_label = f"{start_date or '...'} to {end_date or '...'}"
    pdf.bullet_line("Interaction date range", range_label)
    pdf.bullet_line("Pipeline lookback", f"{days_back} days")
    pdf.bullet_line("Forecast horizon", f"{forecast_days} days")
    pdf.ln(4)

    pdf.section_title("Customer coverage")
    pdf.bullet_line("Total customers", str(metrics.total_customers))
    pdf.bullet_line("With interactions", str(metrics.customers_with_interactions))
    pdf.bullet_line("Quiet in range", str(len(metrics.quiet_customers)))
    if metrics.quiet_customers:
        pdf.ln(2)
        pdf.set_font("Helvetica", "B", 9)
        pdf.cell(0, 5, "Quiet customers (no interactions in range):", new_x="LMARGIN", new_y="NEXT")
        pdf.set_font("Helvetica", "", 9)
        for customer in metrics.quiet_customers[:40]:
            label = customer.customer_name
            if customer.display_id:
                label = f"{customer.display_id} - {label}"
            pdf.cell(0, 5, _safe_text(f"  - {label}"), new_x="LMARGIN", new_y="NEXT")
        if len(metrics.quiet_customers) > 40:
            pdf.cell(
                0,
                5,
                _safe_text(f"  ... and {len(metrics.quiet_customers) - 40} more"),
                new_x="LMARGIN",
                new_y="NEXT",
            )
    pdf.ln(4)

    pdf.section_title("Interaction volume")
    pdf.bullet_line("Total interactions", str(metrics.total_interactions))
    engaged = metrics.customers_with_interactions
    avg = (
        f"{metrics.total_interactions / engaged:.1f}"
        if engaged > 0
        else "0"
    )
    pdf.bullet_line("Avg per engaged customer", avg)
    if metrics.interactions_by_week:
        pdf.ln(2)
        pdf.set_font("Helvetica", "B", 9)
        pdf.cell(0, 5, "Interactions by week:", new_x="LMARGIN", new_y="NEXT")
        pdf.set_font("Helvetica", "", 9)
        for week in metrics.interactions_by_week[-16:]:
            pdf.bullet_line(f"Week of {week.week_start}", str(week.count))
    pdf.ln(4)

    pdf.section_title("Opportunity tracking")
    _append_pipeline_insights(pdf, insights)
    pdf.ln(4)

    pdf.section_title("Revenue forecast")
    _append_forecast(pdf, forecast, forecast_days)

    buffer = BytesIO()
    pdf.output(buffer)
    return buffer.getvalue()


def _append_pipeline_insights(pdf: _CRMReportPDF, insights: PipelineInsights) -> None:
    pdf.bullet_line("Open pipeline value", _money(insights.total_pipeline_value))
    pdf.bullet_line("Proposal+ value", _money(insights.forecast_value))
    pdf.bullet_line("Stuck (>14 days)", str(len(insights.churn_risk_pipelines)))
    stages = [
        (stage, count)
        for stage, count in insights.stage_distribution.items()
        if count > 0
    ]
    if stages:
        pdf.ln(2)
        pdf.set_font("Helvetica", "B", 9)
        pdf.cell(0, 5, "Deals by stage:", new_x="LMARGIN", new_y="NEXT")
        pdf.set_font("Helvetica", "", 9)
        for stage, count in sorted(stages, key=lambda x: x[1], reverse=True):
            pdf.bullet_line(stage, str(count))
    if insights.insights_summary:
        pdf.ln(2)
        pdf.multi_cell(0, 5, _safe_text(insights.insights_summary))


def _append_forecast(pdf: _CRMReportPDF, forecast: PipelineForecast, forecast_days: int) -> None:
    pdf.bullet_line("Forecast window", f"Next {forecast_days} days")
    pdf.bullet_line("Pipelines in window", str(forecast.pipeline_count))
    pdf.bullet_line("Total forecast", _money(forecast.total_forecast_value))
    stages = [
        (stage, value)
        for stage, value in forecast.forecast_by_stage.items()
        if value > 0
    ]
    if stages:
        pdf.ln(2)
        pdf.set_font("Helvetica", "B", 9)
        pdf.cell(0, 5, "Forecast by stage:", new_x="LMARGIN", new_y="NEXT")
        pdf.set_font("Helvetica", "", 9)
        for stage, value in stages:
            pdf.bullet_line(stage, _money(value))
