"""Cross-module report models: CRM + PMS + Stock + Sales Pipeline."""

from typing import List, Optional
from uuid import UUID

from pydantic import BaseModel, Field


class StockReportSummary(BaseModel):
    stock_product_count: int = 0
    total_available_kg: float = 0.0
    addis_available_kg: float = 0.0
    sez_available_kg: float = 0.0
    nairobi_available_kg: float = 0.0
    low_stock_sku_count: int = 0
    catalog_linked_sku_count: int = 0
    pipeline_linked_movements: int = 0
    customer_linked_movements: int = 0


class PmsReportSummary(BaseModel):
    catalog_product_count: int = 0
    catalog_with_current_price: int = 0
    active_pricing_records: int = 0
    total_pricing_records: int = 0
    pricing_location_count: int = 0
    catalog_with_stock_link: int = 0


class PipelineFulfillmentRisk(BaseModel):
    pipeline_id: UUID
    customer_id: UUID
    customer_name: Optional[str] = None
    catalog_uuid_id: Optional[str] = None
    product_name: Optional[str] = None
    stage: str
    deal_quantity: Optional[float] = None
    deal_unit: Optional[str] = None
    addis_available_kg: float = 0.0
    total_available_kg: float = 0.0
    exceeds_addis_stock: bool = False


class IntegratedLinkStats(BaseModel):
    open_pipeline_deals: int = 0
    open_deals_with_catalog_product: int = 0
    open_deals_checked_for_stock: int = 0
    deals_exceeding_addis_stock: int = 0


class IntegratedReportSnapshot(BaseModel):
    stock: StockReportSummary
    pms: PmsReportSummary
    links: IntegratedLinkStats
    fulfillment_risks: List[PipelineFulfillmentRisk] = Field(default_factory=list)
    product_demand_top: List[dict] = Field(default_factory=list)
