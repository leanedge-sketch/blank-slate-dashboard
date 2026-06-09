#!/usr/bin/env python3
"""Probe Chemical_Master_Data table columns in Supabase."""

from __future__ import annotations

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend"))

from dotenv import load_dotenv

load_dotenv(ROOT / ".env", override=False)

from app.database.connection import get_supabase_client

TABLE = "Chemical_Master_Data"

CANDIDATES = [
    "ID",
    "Id",
    "Uuid",
    "UUID",
    "uuid_id",
    "Sector",
    "Industry",
    "Vendor",
    "Product_Category",
    "Sub_Category",
    "Product_Name",
    "Packaging",
    "HS_Code",
    "Price",
    "Typical_Application",
    "Product_Description",
    "Partner_ID",
    "Partner_Id",
    "Brand",
    "Grade",
    "CAS_Number",
    "Country",
    "Unit",
    "Currency",
    "Status",
    "Created_At",
    "Updated_At",
    "created_at",
    "updated_at",
]


def main() -> None:
    client = get_supabase_client()
    ok: list[str] = []
    hints: dict[str, str] = {}

    for col in CANDIDATES:
        try:
            client.table(TABLE).select(col).limit(0).execute()
            ok.append(col)
        except Exception as e:
            msg = str(e)
            m = re.search(r'Perhaps you meant to reference the column "([^"]+)"', msg)
            if m:
                hints[col] = m.group(1)

    print(f"=== {TABLE} ===")
    print("Valid columns probed:", ok)
    print("Hints from errors:")
    for k, v in sorted(hints.items()):
        print(f"  {k!r} -> {v}")

    try:
        resp = client.table(TABLE).select("*").limit(1).execute()
        if resp.data:
            print("Sample row keys:", sorted(resp.data[0].keys()))
        else:
            print("Table empty; no sample row for column discovery.")
    except Exception as e:
        print("select * failed:", e)


if __name__ == "__main__":
    main()
