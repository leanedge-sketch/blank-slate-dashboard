"""
Integrated reporting across CRM, PMS catalog/pricing, stock, and sales pipeline.
"""

from __future__ import annotations

from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional

from app.database.connection import get_supabase_client
from app.models.integrated_report import (
    IntegratedLinkStats,
    IntegratedReportSnapshot,
    PipelineFulfillmentRisk,
    PmsReportSummary,
    StockReportSummary,
    TradeTransitReportSummary,
)
from app.models.sales_pipeline import PIPELINE_STAGES
from app.models.stock import Product
from app.services.chemical_master_data import count_chemical_master_data
from app.services.pms_service import count_pricing_junction_records, list_pricing_locations
from app.services.sales_pipeline_service import (
    _CLOSED_STAGES,
    _coerce_datetime,
    list_sales_pipelines,
)
from app.services.stock_service import (
    _deal_quantity_to_kg,
    build_catalog_availability_index,
    list_products,
)

_LOW_STOCK_KG = 500.0
_OPEN_STAGES = [s for s in PIPELINE_STAGES if s not in _CLOSED_STAGES]
_REPORT_PIPELINE_LIMIT = 400
_REPORT_STOCK_PRODUCT_LIMIT = 500
_QUOTE_STAGES = {"Proposal", "Confirmation", "Validation"}


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


def _batch_customer_names(customer_ids: set[str]) -> Dict[str, str]:
    if not customer_ids:
        return {}
    supabase = get_supabase_client()
    names: Dict[str, str] = {}
    ids = list(customer_ids)
    for start in range(0, len(ids), 80):
        chunk = ids[start : start + 80]
        response = (
            supabase.table("customers")
            .select("customer_id,customer_name")
            .in_("customer_id", chunk)
            .execute()
        )
        for row in response.data or []:
            cid = str(row.get("customer_id") or "")
            if cid:
                names[cid] = row.get("customer_name") or ""
    return names


def product_demand_top(days_back: int = 90, top_n: int = 10) -> List[Dict[str, Any]]:
    """Lightweight product demand counts — no AI (safe for Vercel timeouts)."""
    pipelines = list_sales_pipelines(limit=_REPORT_PIPELINE_LIMIT)
    cutoff = datetime.utcnow() - timedelta(days=days_back)
    counts: Dict[str, int] = {}
    for pipeline in pipelines:
        created = _coerce_datetime(pipeline.created_at)
        if created is not None and created < cutoff:
            continue
        if pipeline.stage in _QUOTE_STAGES:
            product_key = str(pipeline.chemical_type_id or pipeline.tds_id or "unknown")
            counts[product_key] = counts.get(product_key, 0) + 1
    return sorted(
        [{"product_key": k, "quote_count": v} for k, v in counts.items() if v > 0],
        key=lambda row: row["quote_count"],
        reverse=True,
    )[:top_n]


def get_stock_report_summary(
    products: Optional[List[Product]] = None,
) -> StockReportSummary:
    if products is None:
        products = list_products(
            limit=_REPORT_STOCK_PRODUCT_LIMIT, offset=0, batch_stock=True
        )
    addis = sez = nairobi = total = 0.0
    low = 0
    catalog_linked = 0
    for row in products:
        addis += row.available_stock_addis_ababa
        sez += row.available_stock_sez_kenya
        nairobi += row.available_stock_nairobi_partner
        total += row.total_available_stock
        if row.total_available_stock < _LOW_STOCK_KG:
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
        stock_product_count=len(products),
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


def get_pipeline_fulfillment_risks(
    limit: int = 15,
    *,
    catalog_index: Optional[Dict[str, Dict[str, Any]]] = None,
) -> tuple[List[PipelineFulfillmentRisk], IntegratedLinkStats]:
    stock_by_catalog = catalog_index
    if stock_by_catalog is None:
        products = list_products(
            limit=_REPORT_STOCK_PRODUCT_LIMIT, offset=0, batch_stock=True
        )
        stock_by_catalog = build_catalog_availability_index(products)

    pipelines = list_sales_pipelines(limit=_REPORT_PIPELINE_LIMIT)
    open_deals = [p for p in pipelines if p.stage in _OPEN_STAGES]

    customer_ids = {str(p.customer_id) for p in open_deals if p.customer_id}
    customer_names = _batch_customer_names(customer_ids)

    risks: List[PipelineFulfillmentRisk] = []
    with_catalog = 0
    checked = 0
    exceeds_count = 0

    for pipeline in open_deals:
        catalog_id = str(pipeline.chemical_type_id) if pipeline.chemical_type_id else None
        if catalog_id:
            with_catalog += 1

        if not catalog_id:
            continue

        checked += 1
        stock = stock_by_catalog.get(
            catalog_id,
            {
                "addis_ababa_available": 0.0,
                "total_available": 0.0,
                "product_name": "Unknown",
            },
        )

        deal_kg = _deal_quantity_to_kg(pipeline.amount, pipeline.unit)
        exceeds = False
        if deal_kg is not None and deal_kg > float(stock["addis_ababa_available"]):
            exceeds = True
            exceeds_count += 1

        risk = PipelineFulfillmentRisk(
            pipeline_id=pipeline.id,
            customer_id=pipeline.customer_id,
            customer_name=customer_names.get(str(pipeline.customer_id)),
            catalog_uuid_id=catalog_id,
            product_name=stock.get("product_name"),
            stage=pipeline.stage,
            deal_quantity=pipeline.amount,
            deal_unit=pipeline.unit,
            addis_available_kg=float(stock["addis_ababa_available"]),
            total_available_kg=float(stock["total_available"]),
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


def get_trade_transit_report_summary(limit: int = 10) -> TradeTransitReportSummary:
    supabase = get_supabase_client()
    try:
        response = (
            supabase.table("import_finance_shipments")
            .select(
                "id, client_name, customer_id, chemical_type_id, quantity_kg, "
                "final_landed_unit_cost_etb_per_kg, gross_margin_pct, status, created_at"
            )
            .eq("pipeline_domain", "procurement")
            .order("created_at", desc=True)
            .limit(500)
            .execute()
        )
    except Exception:
        return TradeTransitReportSummary()

    rows = response.data or []
    if not rows:
        return TradeTransitReportSummary()

    linked_catalog = sum(1 for r in rows if r.get("chemical_type_id"))
    linked_crm = sum(1 for r in rows if r.get("customer_id"))
    clients = {
        str(r.get("customer_id") or r.get("client_name") or "").strip().lower()
        for r in rows
        if (r.get("customer_id") or r.get("client_name"))
    }
    total_kg = sum(float(r.get("quantity_kg") or 0) for r in rows)

    landed_vals = [
        float(r["final_landed_unit_cost_etb_per_kg"])
        for r in rows
        if r.get("final_landed_unit_cost_etb_per_kg") is not None
    ]
    margin_vals = [
        float(r["gross_margin_pct"])
        for r in rows
        if r.get("gross_margin_pct") is not None
    ]

    recent = []
    for r in rows[:limit]:
        recent.append(
            {
                "id": str(r.get("id")),
                "client_name": r.get("client_name"),
                "customer_id": str(r.get("customer_id")) if r.get("customer_id") else None,
                "chemical_type_id": r.get("chemical_type_id"),
                "quantity_kg": r.get("quantity_kg"),
                "landed_etb_per_kg": r.get("final_landed_unit_cost_etb_per_kg"),
                "gross_margin_pct": r.get("gross_margin_pct"),
                "status": r.get("status"),
                "created_at": r.get("created_at"),
            }
        )

    return TradeTransitReportSummary(
        shipment_count=len(rows),
        linked_to_catalog_count=linked_catalog,
        linked_to_crm_count=linked_crm,
        unique_clients_count=len(clients),
        total_quantity_kg=total_kg,
        avg_landed_cost_etb_per_kg=(
            sum(landed_vals) / len(landed_vals) if landed_vals else None
        ),
        avg_gross_margin_pct=(
            sum(margin_vals) / len(margin_vals) if margin_vals else None
        ),
        recent_shipments=recent,
    )


def get_integrated_report_snapshot(days_back: int = 90) -> IntegratedReportSnapshot:
    products = list_products(limit=_REPORT_STOCK_PRODUCT_LIMIT, offset=0, batch_stock=True)
    catalog_index = build_catalog_availability_index(products)
    fulfillment_risks, links = get_pipeline_fulfillment_risks(
        limit=15,
        catalog_index=catalog_index,
    )

    return IntegratedReportSnapshot(
        stock=get_stock_report_summary(products),
        pms=get_pms_report_summary(),
        trade_transit=get_trade_transit_report_summary(limit=10),
        links=links,
        fulfillment_risks=fulfillment_risks,
        product_demand_top=product_demand_top(days_back=days_back, top_n=10),
    )
