#!/usr/bin/env python3
"""Probe sales_pipeline table and service smoke tests."""

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
from app.services.sales_pipeline_service import (
    list_sales_pipelines,
    count_sales_pipelines,
    normalize_pipeline_row_from_db,
    _resolve_chemical_type_id,
)


def main() -> int:
    client = get_supabase_client()
    print("=== sales_pipeline table ===\n")
    try:
        resp = client.table("sales_pipeline").select("*", count="exact").limit(1).execute()
        count = getattr(resp, "count", 0)
        row = (resp.data or [{}])[0] if resp.data else {}
        print(f"OK   rows={count}")
        if row:
            print(f"     columns: {', '.join(sorted(row.keys())[:15])}...")
    except Exception as e:
        print(f"FAIL {e}")
        return 1

    print("\n=== Service smoke ===\n")
    pipelines = list_sales_pipelines(limit=5)
    print(f"OK   list_sales_pipelines count={len(pipelines)} total={count_sales_pipelines()}")
    if pipelines:
        p = pipelines[0]
        print(f"     sample stage={p.stage} customer={str(p.customer_id)[:8]}…")

    # Resolve catalog id if any chemical_full_data exists
    cfd = client.table("chemical_full_data").select("id,uuid_id").limit(1).execute()
    if cfd.data:
        int_id = cfd.data[0]["id"]
        resolved = _resolve_chemical_type_id(str(int_id))
        print(f"OK   resolve chemical_type_id {int_id} -> {resolved}")

    print("\nDone.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
