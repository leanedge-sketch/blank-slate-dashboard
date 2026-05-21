#!/usr/bin/env python3
"""Probe Supabase PMS tables and sample columns."""

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

TABLES = [
    "chemical_full_data",
    "tds_data",
    "partner_data",
    "partner_chemicals",
    "leanchem_products",
    "costing_pricing_data",
]


def main() -> int:
    client = get_supabase_client()
    print("=== PMS table probe ===\n")
    failures = 0
    for table in TABLES:
        try:
            resp = client.table(table).select("*").limit(1).execute()
            row = (resp.data or [{}])[0] if resp.data else {}
            cols = sorted(row.keys()) if row else []
            count_resp = client.table(table).select("*", count="exact").limit(0).execute()
            count = getattr(count_resp, "count", len(resp.data or []))
            print(f"OK   {table:24} rows={count:>4}  cols={cols[:12]}{'...' if len(cols) > 12 else ''}")
            if row:
                print(f"     sample keys ({len(cols)}): {', '.join(cols)}")
        except Exception as e:
            failures += 1
            print(f"FAIL {table:24}  {e}")
        print()
    return 1 if failures else 0


if __name__ == "__main__":
    raise SystemExit(main())
