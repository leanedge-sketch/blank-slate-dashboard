#!/usr/bin/env python3
"""Copy chemical_full_data rows into Chemical_Master_Data (one-time migration)."""

from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend"))

from dotenv import load_dotenv

load_dotenv(ROOT / ".env", override=False)

from app.database.connection import get_supabase_service_client
from app.services.chemical_master_data import row_to_api, api_to_db, TABLE, _next_row_no


def main() -> int:
    client = get_supabase_service_client()
    source = client.table("chemical_full_data").select("*").execute()
    rows = source.data or []
    print(f"Found {len(rows)} chemical_full_data rows")

    existing = client.table(TABLE).select("Row_No,Product_Name").execute()
    existing_names = {
        (r.get("Product_Name") or "").strip().lower()
        for r in (existing.data or [])
        if r.get("Product_Name")
    }
    next_no = _next_row_no(client)
    created = 0
    skipped = 0

    for row in rows:
        name_key = (row.get("product_name") or "").strip().lower()
        if name_key and name_key in existing_names:
            skipped += 1
            continue
        api = row_to_api(
            {
                "Row_No": row.get("id"),
                "Supplier_Name": row.get("vendor"),
                "Category": row.get("product_category"),
                "Sub_Category": row.get("sub_category"),
                "Product_Name": row.get("product_name"),
                "Packaging": row.get("packing"),
                "HS_Code": row.get("hs_code"),
                "Sector": row.get("sector"),
                "Industry": row.get("industry"),
                "Typical_Application": row.get("typical_application"),
                "Product_Description": row.get("product_description"),
                "Price": row.get("price"),
                "Partner_ID": row.get("partner_id"),
                "uuid_id": row.get("uuid_id"),
            }
        )
        payload = api_to_db(api.model_dump())
        if not payload.get("Row_No"):
            payload["Row_No"] = next_no
            next_no += 1
        payload.pop("uuid_id", None)
        if row.get("industry") and not payload.get("Product_Type"):
            payload["Product_Type"] = row.get("industry")
        if row.get("typical_application") and not payload.get("Generic_Name"):
            payload["Generic_Name"] = row.get("typical_application")
        for drop in (
            "Industry",
            "Price",
            "Typical_Application",
            "Product_Description",
            "Partner_ID",
        ):
            payload.pop(drop, None)
        try:
            client.table(TABLE).insert(payload).execute()
            created += 1
            if name_key:
                existing_names.add(name_key)
        except Exception as exc:
            print(f"  skip id={row.get('id')}: {exc}")

    print(f"Done: created={created}, skipped={skipped}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
