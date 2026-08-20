"""Executive report snapshot models backed by materialized views."""

from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, Field


class ExecutiveSalesSummaryRow(BaseModel):
    stage: str
    currency: Optional[str] = None
    total_deals: int = 0
    pipeline_value_usd: float = 0.0


class ExecutiveTransitSummaryRow(BaseModel):
    status: str
    active_shipments: int = 0
    total_transit_value: float = 0.0


class ExecutiveStockAlertRow(BaseModel):
    product_id: Optional[UUID] = None
    product_name: str
    location: str
    available_kg: float = 0.0
    minimum_stock_threshold: float = 0.0
    deficit_kg: float = 0.0


class ExecutiveCrmActivityRow(BaseModel):
    window_key: str = "weekly"
    new_customers_7d: int = 0
    interactions_7d: int = 0
    total_customers: int = 0
    refreshed_at: Optional[datetime] = None


class ExecutiveReportSnapshot(BaseModel):
    """Canonical executive-summary payload for the dashboard + briefing worker."""

    financials: dict = Field(default_factory=dict)
    sales_summary: list[ExecutiveSalesSummaryRow] = Field(default_factory=list)
    transit_summary: list[ExecutiveTransitSummaryRow] = Field(default_factory=list)
    stock_alerts: list[ExecutiveStockAlertRow] = Field(default_factory=list)
    crm_activity: Optional[ExecutiveCrmActivityRow] = None
