#!/usr/bin/env python3
"""Map Supabase tables to app modules (PMS, CRM, Sales, Stock)."""

from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend"))

MAPPING = [
    ("PMS", "chemical_full_data", "/pms/chemicals", "pms_service"),
    ("PMS", "tds_data", "/pms/tds", "pms_service"),
    ("PMS", "partner_data", "/pms/partners", "pms_service"),
    ("PMS", "partner_chemicals", "/pms/partner-chemicals", "pms_service"),
    ("PMS", "leanchem_products", "/pms/products", "pms_service"),
    ("PMS", "costing_pricing_data", "/pms/pricing", "pms_service"),
    ("CRM", "customers", "/crm/customers", "crm_service"),
    ("CRM", "interactions", "/crm/.../interactions", "crm_service + pipeline_crm_sync"),
    ("Sales", "sales_pipeline", "/sales/pipeline", "sales_pipeline_service"),
    ("Stock", "products", "/stock", "stock_service"),
    ("Stock", "stock_movements", "/stock", "stock_service"),
]

def main() -> int:
    print("Platform table → route → service\n")
    for dock, table, route, svc in MAPPING:
        print(f"  [{dock:5}] {table:24} {route:28} {svc}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
