#!/usr/bin/env python3
"""List distinct industry-related values in Chemical_Master_Data."""

from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend"))

from dotenv import load_dotenv

for env_path in (ROOT / ".env", ROOT / "backend" / ".env"):
    if env_path.exists():
        load_dotenv(env_path, override=False)

from app.database.connection import get_supabase_service_client, get_supabase_client


def main() -> int:
    try:
        client = get_supabase_service_client()
    except RuntimeError:
        client = get_supabase_client()

    resp = (
        client.table("Chemical_Master_Data")
        .select("Industry,Product_Type,Sector,Category,Sub_Category,Product_Name")
        .limit(5000)
        .execute()
    )
    rows = resp.data or []
    industries: set[str] = set()
    types: set[str] = set()
    sectors: set[str] = set()
    for row in rows:
        for key, bucket in (
            ("Industry", industries),
            ("Product_Type", types),
            ("Sector", sectors),
        ):
            val = (row.get(key) or "").strip()
            if val:
                bucket.add(val)

    lines = [
        f"ROWS {len(rows)}",
        f"INDUSTRIES {sorted(industries)}",
        f"PRODUCT_TYPES {sorted(types)}",
        f"SECTORS {sorted(sectors)}",
    ]
    out = ROOT / "scripts" / "industry_values_report.txt"
    out.write_text("\n".join(lines), encoding="utf-8")
    print(f"Wrote {out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
