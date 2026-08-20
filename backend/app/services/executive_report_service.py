"""Executive report service backed by PostgreSQL materialized views only."""

from __future__ import annotations

from typing import Any, Optional
from uuid import UUID

from app.database.connection import get_supabase_client
from app.models.executive_report import (
    ExecutiveCrmActivityRow,
    ExecutiveReportSnapshot,
    ExecutiveSalesSummaryRow,
    ExecutiveStockAlertRow,
    ExecutiveTransitSummaryRow,
)


def _to_int(value: object) -> int:
    try:
        return int(value or 0)
    except (TypeError, ValueError):
        return 0


def _to_float(value: object) -> float:
    try:
        return float(value or 0)
    except (TypeError, ValueError):
        return 0.0


def _safe_uuid(value: object) -> Optional[UUID]:
    if value is None:
        return None
    try:
        return UUID(str(value))
    except (TypeError, ValueError):
        return None


def get_executive_report_snapshot() -> ExecutiveReportSnapshot:
    """
    Read the canonical executive reporting snapshot from materialized views.
    No live heavy aggregations — SELECT from MVs only.
    """
    supabase = get_supabase_client()

    sales_response = (
        supabase.table("mv_exec_sales_summary")
        .select("stage,currency,total_deals,pipeline_value_usd")
        .order("stage")
        .execute()
    )
    transit_response = (
        supabase.table("mv_exec_transit_summary")
        .select("status,active_shipments,total_transit_value")
        .order("status")
        .execute()
    )

    stock_rows: list[dict[str, Any]] = []
    try:
        stock_response = (
            supabase.table("mv_exec_stock_alerts")
            .select(
                "product_id,product_name,location,available_kg,"
                "minimum_stock_threshold,deficit_kg"
            )
            .order("deficit_kg", desc=True)
            .limit(25)
            .execute()
        )
        stock_rows = stock_response.data or []
    except Exception:
        stock_rows = []

    crm_row: Optional[dict[str, Any]] = None
    try:
        crm_response = (
            supabase.table("mv_exec_crm_activity")
            .select(
                "window_key,new_customers_7d,interactions_7d,total_customers,refreshed_at"
            )
            .limit(1)
            .execute()
        )
        crm_row = (crm_response.data or [None])[0]
    except Exception:
        crm_row = None

    sales_rows = [
        ExecutiveSalesSummaryRow(
            stage=str(row.get("stage") or "Unknown"),
            currency=(str(row.get("currency")) if row.get("currency") is not None else None),
            total_deals=_to_int(row.get("total_deals")),
            pipeline_value_usd=_to_float(row.get("pipeline_value_usd")),
        )
        for row in (sales_response.data or [])
    ]
    transit_rows = [
        ExecutiveTransitSummaryRow(
            status=str(row.get("status") or "unknown"),
            active_shipments=_to_int(row.get("active_shipments")),
            total_transit_value=_to_float(row.get("total_transit_value")),
        )
        for row in (transit_response.data or [])
    ]
    stock_alerts = [
        ExecutiveStockAlertRow(
            product_id=_safe_uuid(row.get("product_id")),
            product_name=str(row.get("product_name") or "Unknown product"),
            location=str(row.get("location") or "unknown"),
            available_kg=_to_float(row.get("available_kg")),
            minimum_stock_threshold=_to_float(row.get("minimum_stock_threshold")),
            deficit_kg=_to_float(row.get("deficit_kg")),
        )
        for row in stock_rows
    ]
    crm_activity = None
    if crm_row:
        crm_activity = ExecutiveCrmActivityRow(
            window_key=str(crm_row.get("window_key") or "weekly"),
            new_customers_7d=_to_int(crm_row.get("new_customers_7d")),
            interactions_7d=_to_int(crm_row.get("interactions_7d")),
            total_customers=_to_int(crm_row.get("total_customers")),
            refreshed_at=crm_row.get("refreshed_at"),
        )

    return ExecutiveReportSnapshot(
        financials={
            "sales_summary": [r.model_dump() for r in sales_rows],
            "transit_summary": [r.model_dump() for r in transit_rows],
        },
        sales_summary=sales_rows,
        transit_summary=transit_rows,
        stock_alerts=stock_alerts,
        crm_activity=crm_activity,
    )
