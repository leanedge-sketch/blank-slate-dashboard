#!/usr/bin/env python3
"""Probe Supabase tables used by Stock dock and Reports & Analysis."""

from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BACKEND = ROOT / "backend"
sys.path.insert(0, str(BACKEND))

# Load backend/.env or repo root .env
from dotenv import load_dotenv

for env_path in (ROOT / ".env", BACKEND / ".env", ROOT / "frontend" / ".env"):
    if env_path.exists():
        load_dotenv(env_path, override=False)
        print(f"Loaded env: {env_path}")
# pydantic settings in app.config also loads backend/.env on import

from app.database.connection import get_supabase_client, get_supabase_service_client


TABLES = [
    ("products", "id", "Stock — product catalog"),
    ("stock_movements", "id", "Stock — movement ledger"),
    ("customers", "customer_id", "Reports — customer coverage & stages"),
    ("interactions", "id", "Reports — interaction counts & weekly chart"),
    ("sales_pipeline", "id", "Reports — pipeline insights & forecast"),
]

VIEWS = [
    ("stock_balance_by_product_location", "Stock — optional SQL view (docs/0003)"),
    ("stock_balance_by_location", "Stock — optional SQL view rollup"),
]


def probe_table(client, name: str, pk: str, label: str) -> dict:
    result = {"name": name, "label": label, "ok": False, "count": None, "error": None}
    try:
        resp = client.table(name).select(pk, count="exact").limit(1).execute()
        result["count"] = getattr(resp, "count", None)
        if result["count"] is None and resp.data is not None:
            # Fallback: fetch one row
            resp2 = client.table(name).select("*").limit(1).execute()
            result["count"] = "≥1" if resp2.data else 0
        result["ok"] = True
    except Exception as e:
        result["error"] = str(e)
    return result


def probe_view(client, name: str, label: str) -> dict:
    result = {"name": name, "label": label, "ok": False, "count": None, "error": None}
    try:
        resp = client.table(name).select("*").limit(1).execute()
        result["ok"] = True
        result["count"] = "present" if resp.data else "empty"
    except Exception as e:
        result["error"] = str(e)
    return result


def main() -> int:
    try:
        client = get_supabase_client()
    except Exception as e:
        print(f"FAIL: Cannot create Supabase client: {e}")
        return 1

    print("\n=== Stock & Reports — table probe (anon key) ===\n")
    failures = 0
    for name, pk, label in TABLES:
        r = probe_table(client, name, pk, label)
        if r["ok"]:
            print(f"OK   {name:22} count={r['count']:>6}  — {label}")
        else:
            failures += 1
            print(f"FAIL {name:22}  — {label}")
            print(f"     {r['error']}")

    print("\n=== Optional stock balance views ===\n")
    for name, label in VIEWS:
        r = probe_view(client, name, label)
        if r["ok"]:
            print(f"OK   {name:35} ({r['count']}) — {label}")
        else:
            print(f"SKIP {name:35} — {r['error'][:120]}")

    # Dashboard metrics smoke test
    print("\n=== Service-layer smoke tests ===\n")
    try:
        from app.services.crm_service import get_dashboard_metrics
        from app.services.stock_service import list_products, get_stock_availability_summary
        from app.services.sales_pipeline_service import generate_pipeline_insights, get_pipeline_forecast

        m = get_dashboard_metrics()
        print(
            f"OK   get_dashboard_metrics       customers={m.total_customers} "
            f"interactions={m.total_interactions} quiet={len(m.quiet_customers)}"
        )
        products = list_products(limit=5)
        print(f"OK   list_products               returned={len(products)} (limit 5)")
        summaries = get_stock_availability_summary(limit=5)
        print(f"OK   get_stock_availability      returned={len(summaries)} (limit 5)")
        insights = generate_pipeline_insights(days_back=90)
        print(
            f"OK   generate_pipeline_insights  open_value={insights.total_pipeline_value:.0f} "
            f"stages={sum(insights.stage_distribution.values())}"
        )
        forecast = get_pipeline_forecast(days_ahead=30)
        print(
            f"OK   get_pipeline_forecast       total={forecast.total_forecast_value:.0f} "
            f"pipelines={forecast.pipeline_count}"
        )
    except Exception as e:
        failures += 1
        print(f"FAIL service smoke test: {e}")

    # Service role (if configured) — same tables
    try:
        svc = get_supabase_service_client()
        print("\n=== Service role re-check (interactions sample) ===\n")
        resp = svc.table("interactions").select("id", count="exact").limit(1).execute()
        print(f"OK   interactions (service) count={getattr(resp, 'count', '?')}")
    except Exception as e:
        print(f"SKIP service client: {e}")

    print(f"\nDone. Table failures: {failures}")
    return 1 if failures else 0


if __name__ == "__main__":
    raise SystemExit(main())
