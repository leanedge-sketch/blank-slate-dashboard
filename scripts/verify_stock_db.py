#!/usr/bin/env python3
"""Probe Supabase tables used by the Stock workspace."""

from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend"))

from dotenv import load_dotenv

for env_path in (ROOT / ".env", ROOT / "backend" / ".env"):
    if env_path.exists():
        load_dotenv(env_path, override=False)

from app.database.connection import get_supabase_client
from app.services.stock_service import (
    list_products,
    list_stock_movements,
    get_stock_availability_summary,
)


def main() -> int:
    client = get_supabase_client()
    print("=== Stock workspace — table probe ===\n")
    failures = 0
    for table, pk in [("products", "id"), ("stock_movements", "id")]:
        try:
            resp = client.table(table).select(pk, count="exact").limit(1).execute()
            count = getattr(resp, "count", "?")
            print(f"OK   {table:20} rows={count}")
        except Exception as e:
            failures += 1
            print(f"FAIL {table:20} {e}")

    for view in ("stock_balance_by_product_location", "stock_balance_by_location"):
        try:
            client.table(view).select("*").limit(1).execute()
            print(f"OK   {view}")
        except Exception as e:
            print(f"SKIP {view} — {str(e)[:60]}")

    print("\n=== Service smoke ===\n")
    try:
        print(f"OK   products={len(list_products(limit=10))} movements={len(list_stock_movements(limit=10))}")
        print(f"OK   availability summaries={len(get_stock_availability_summary(limit=10))}")
    except Exception as e:
        failures += 1
        print(f"FAIL {e}")

    print(f"\nDone. failures={failures}")
    return 1 if failures else 0


if __name__ == "__main__":
    raise SystemExit(main())
