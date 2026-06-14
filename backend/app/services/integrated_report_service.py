"""
Integrated reporting across CRM, PMS catalog/pricing, stock, and sales pipeline.
"""

from __future__ import annotations

from typing import List, Optional

from app.database.connection import get_supabase_client
from app.models.integrated_report import (
    IntegratedLinkStats,
    IntegratedReportSnapshot,
    PipelineFulfillmentRisk,
    PmsReportSummary,
    StockReportSummary,
)
from app.models.sales_pipeline import PIPELINE_STAGES
from app.services.chemical_master_data import count_chemical_master_data
from app.services.crm_service import get_customer_by_id
from app.services.pms_service import count_pricing_junction_records, list_pricing_locations
from app.services.sales_pipeline_service import (
    _CLOSED_STAGES,
    generate_pipeline_insights,
    list_sales_pipelines,
)
from app.services.stock_service import (
    _deal_quantity_to_kg,
    get_stock_availability_by_catalog,
    get_stock_availability_summary,
)

_LOW_STOCK_KG = 500.0
_OPEN_STAGES = [s for s in PIPELINE_STAGES if s not in _CLOSED_STAGES]


def _count_table_rows(table: str, *, column: str, not_null: bool = False) -> int:
    supabase = get_supabase_client()
    query = supabase.table(table).select(column, count="exact")
    if not_null:
        query = query.not_.is_(column, "null")
    response = query.execute()
    return response.count or 0


def _count_pricing_by_status(status: Optional[str] = None) -> int:
    supabase = get_supabase_client()
    query = supabase.table("pricing_records").select("id", count="exact")
    if status:
        query = query.eq("status", status)
    response = query.execute()
    return response.count or 0


def get_stock_report_summary() -> StockReportSummary:
    summaries = get_stock_availability_summary(limit=1000, offset=0)
    addis = sez = nairobi = total = 0.0
    low = 0
    catalog_linked = 0
    for row in summaries:
        addis += row.addis_ababa_available
        sez += row.sez_kenya_available
        nairobi += row.nairobi_partner_available
        total += row.total_available
        if row.total_available < _LOW_STOCK_KG:
            low += 1

    supabase = get_supabase_client()
    try:
        catalog_linked = _count_table_rows("products", column="catalog_uuid_id", not_null=True)
    except Exception:
        catalog_linked = 0

    pipeline_movements = 0
    customer_movements = 0
    try:
        r1 = (
            supabase.table("stock_movements")
            .select("id", count="exact")
            .not_.is_("pipeline_id", "null")
            .execute()
        )
        pipeline_movements = r1.count or 0
        r2 = (
            supabase.table("stock_movements")
            .select("id", count="exact")
            .not_.is_("customer_id", "null")
            .execute()
        )
        customer_movements = r2.count or 0
    except Exception:
        pass

    return StockReportSummary(
        stock_product_count=len(summaries),
        total_available_kg=total,
        addis_available_kg=addis,
        sez_available_kg=sez,
        nairobi_available_kg=nairobi,
        low_stock_sku_count=low,
        catalog_linked_sku_count=catalog_linked,
        pipeline_linked_movements=pipeline_movements,
        customer_linked_movements=customer_movements,
    )


def get_pms_report_summary() -> PmsReportSummary:
    catalog_count = count_chemical_master_data()
    total_pricing = count_pricing_junction_records()
    active_pricing = _count_pricing_by_status("active")
    locations = list_pricing_locations(limit=500)

    catalog_with_price = 0
    try:
        supabase = get_supabase_client()
        response = (
            supabase.table("Chemical_Master_Data")
            .select("Row_No", count="exact")
            .not_.is_("Current_Price", "null")
            .execute()
        )
        catalog_with_price = response.count or 0
    except Exception:
        pass

    catalog_with_stock = 0
    try:
        catalog_with_stock = _count_table_rows(
            "products", column="catalog_uuid_id", not_null=True
        )
    except Exception:
        pass

    return PmsReportSummary(
        catalog_product_count=catalog_count,
        catalog_with_current_price=catalog_with_price,
        active_pricing_records=active_pricing,
        total_pricing_records=total_pricing,
        pricing_location_count=len(locations),
        catalog_with_stock_link=catalog_with_stock,
    )


def get_pipeline_fulfillment_risks(limit: int = 15) -> tuple[List[PipelineFulfillmentRisk], IntegratedLinkStats]:
    pipelines = list_sales_pipelines(limit=2000)
    open_deals = [p for p in pipelines if p.stage in _OPEN_STAGES]

    risks: List[PipelineFulfillmentRisk] = []
    with_catalog = 0
    checked = 0
    exceeds_count = 0

    for pipeline in open_deals:
        catalog_id = str(pipeline.chemical_type_id) if pipeline.chemical_type_id else None
        if catalog_id:
            with_catalog += 1

        if not catalog_id and not pipeline.tds_id:
            continue

        availability = get_stock_availability_by_catalog(
            catalog_id or "",
            tds_id=str(pipeline.tds_id) if pipeline.tds_id else None,
        )
        checked += 1

        deal_kg = _deal_quantity_to_kg(pipeline.amount, pipeline.unit)
        exceeds = False
        if deal_kg is not None and deal_kg > availability.addis_ababa_available:
            exceeds = True
            exceeds_count += 1

        customer_name: Optional[str] = None
        cust = get_customer_by_id(str(pipeline.customer_id))
        if cust and cust.customer_name:
            customer_name = cust.customer_name

        risk = PipelineFulfillmentRisk(
            pipeline_id=pipeline.id,
            customer_id=pipeline.customer_id,
            customer_name=customer_name,
            catalog_uuid_id=catalog_id,
            product_name=availability.product_name,
            stage=pipeline.stage,
            deal_quantity=pipeline.amount,
            deal_unit=pipeline.unit,
            addis_available_kg=availability.addis_ababa_available,
            total_available_kg=availability.total_available,
            exceeds_addis_stock=exceeds,
        )

        if exceeds:
            risks.append(risk)

    risks.sort(
        key=lambda r: (
            0 if r.exceeds_addis_stock else 1,
            -(r.deal_quantity or 0),
        )
    )
    risks = risks[:limit]

    links = IntegratedLinkStats(
        open_pipeline_deals=len(open_deals),
        open_deals_with_catalog_product=with_catalog,
        open_deals_checked_for_stock=checked,
        deals_exceeding_addis_stock=exceeds_count,
    )
    return risks, links


def get_integrated_report_snapshot(days_back: int = 90) -> IntegratedReportSnapshot:
    insights = generate_pipeline_insights(days_back=days_back)
    product_demand_top = sorted(
        [
            {"product_key": k, "quote_count": v}
            for k, v in (insights.product_demand or {}).items()
            if v > 0
        ],
        key=lambda x: x["quote_count"],
        reverse=True,
    )[:10]

    fulfillment_risks, links = get_pipeline_fulfillment_risks(limit=15)

    return IntegratedReportSnapshot(
        stock=get_stock_report_summary(),
        pms=get_pms_report_summary(),
        links=links,
        fulfillment_risks=fulfillment_risks,
        product_demand_top=product_demand_top,
    )
