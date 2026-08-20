"""Home At a Glance SQL metrics and cache reads. AI synthesis is worker-only."""

from __future__ import annotations

import json
import logging
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from typing import Any, Dict, Optional

from app.database.connection import get_supabase_service_client

logger = logging.getLogger(__name__)

OPEN_DEAL_STAGES = ("Quotation", "Negotiation", "Proposal", "Confirmation")
IN_TRANSIT_STATUSES = ("in_transit", "In Transit", "Ocean Transit")


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _count_in(table: str, column: str, values: tuple[str, ...], id_col: str = "id") -> int:
    supabase = get_supabase_service_client()
    resp = (
        supabase.table(table)
        .select(id_col, count="exact")
        .in_(column, list(values))
        .limit(1)
        .execute()
    )
    return int(resp.count or 0)


def _count_eq(table: str, column: str, value: str, id_col: str = "id") -> int:
    supabase = get_supabase_service_client()
    resp = (
        supabase.table(table)
        .select(id_col, count="exact")
        .eq(column, value)
        .limit(1)
        .execute()
    )
    return int(resp.count or 0)


def count_open_deals() -> int:
    try:
        return _count_in("sales_pipeline", "stage", OPEN_DEAL_STAGES)
    except Exception as exc:
        logger.debug("open deals count failed: %s", exc)
        return 0


def count_low_stock_labels() -> int:
    """Product labels whose calculated stock is below minimum_threshold."""
    supabase = get_supabase_service_client()
    for table, stock_col, thresh_col, id_col in (
        ("product_labels", "current_stock", "minimum_threshold", "id"),
        ("products", "total_available_stock", "minimum_threshold", "id"),
    ):
        try:
            resp = (
                supabase.table(table)
                .select(f"{id_col},{stock_col},{thresh_col}")
                .limit(3000)
                .execute()
            )
            n = 0
            for row in resp.data or []:
                thresh = row.get(thresh_col)
                if thresh is None:
                    continue
                stock = float(row.get(stock_col) or 0)
                if stock < float(thresh):
                    n += 1
            return n
        except Exception as exc:
            logger.debug("low-stock probe %s failed: %s", table, exc)
    try:
        resp = (
            supabase.table("products")
            .select("id,total_available_stock")
            .limit(3000)
            .execute()
        )
        return sum(
            1
            for row in (resp.data or [])
            if float(row.get("total_available_stock") or 0) <= 0
        )
    except Exception as exc:
        logger.debug("low-stock fallback failed: %s", exc)
        return 0


def count_in_transit_shipments() -> int:
    try:
        return _count_in("import_finance_shipments", "status", IN_TRANSIT_STATUSES)
    except Exception:
        pass
    try:
        return _count_eq("import_finance_shipments", "status", "in_transit")
    except Exception as exc:
        logger.debug("in-transit count failed: %s", exc)
        return 0


def count_active_customers() -> int:
    supabase = get_supabase_service_client()
    try:
        resp = (
            supabase.table("customers")
            .select("customer_id", count="exact")
            .eq("is_active", True)
            .limit(1)
            .execute()
        )
        return int(resp.count or 0)
    except Exception:
        try:
            resp = (
                supabase.table("customers")
                .select("customer_id", count="exact")
                .limit(1)
                .execute()
            )
            return int(resp.count or 0)
        except Exception as exc:
            logger.debug("customer count failed: %s", exc)
            return 0


def collect_home_metrics() -> Dict[str, Any]:
    """Run the four operational counts in parallel (thread pool)."""
    with ThreadPoolExecutor(max_workers=4) as pool:
        f_deals = pool.submit(count_open_deals)
        f_stock = pool.submit(count_low_stock_labels)
        f_transit = pool.submit(count_in_transit_shipments)
        f_customers = pool.submit(count_active_customers)
        deals = f_deals.result()
        low_stock = f_stock.result()
        in_transit = f_transit.result()
        customers = f_customers.result()
    return {
        "open_deals_quotation_negotiation": deals,
        "open_deal_count": deals,
        "low_stock_label_count": low_stock,
        "in_transit_shipment_count": in_transit,
        "active_customer_count": customers,
        "customer_count": customers,
        "generated_at": _now().isoformat(),
    }


def format_live_ledger_markdown(metrics: Dict[str, Any]) -> str:
    return (
        f"- {metrics.get('open_deals_quotation_negotiation', 0)} deals in quotation/negotiation\n"
        f"- {metrics.get('low_stock_label_count', 0)} labels below minimum stock\n"
        f"- {metrics.get('in_transit_shipment_count', 0)} shipments in transit · "
        f"{metrics.get('active_customer_count', 0)} active customers"
    )


def parse_expires(value: Any) -> Optional[datetime]:
    if not value:
        return None
    try:
        return datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    except Exception:
        return None


def read_unexpired_home_summary() -> Optional[Dict[str, Any]]:
    try:
        supabase = get_supabase_service_client()
        resp = (
            supabase.table("home_summary_cache")
            .select(
                "summary_markdown, metrics_payload, provider_used, is_fallback, created_at, expires_at"
            )
            .gt("expires_at", _now().isoformat())
            .order("created_at", desc=True)
            .limit(1)
            .execute()
        )
        rows = resp.data or []
        if not rows:
            return None
        row = rows[0]
        return {**row, "is_live_sql": False, "stale": False}
    except Exception as exc:
        logger.debug("home_summary_cache read skipped: %s", exc)
        return None


def live_sql_payload() -> Dict[str, Any]:
    metrics = collect_home_metrics()
    return {
        "summary_markdown": format_live_ledger_markdown(metrics),
        "metrics_payload": metrics,
        "provider_used": "sql",
        "is_fallback": True,
        "is_live_sql": True,
        "stale": True,
        "created_at": metrics.get("generated_at"),
    }


AI_SYNTHESIS_PROMPT = (
    "You are an operations dashboard summarizer for LeanChem. Given these operational "
    "metrics: {metrics_json}, produce exactly 3 crisp executive bullet points highlighting "
    "critical focus areas. Keep each bullet under 12 words."
)


def build_ai_prompt(metrics: Dict[str, Any]) -> str:
    return AI_SYNTHESIS_PROMPT.format(metrics_json=json.dumps(metrics, default=str))
