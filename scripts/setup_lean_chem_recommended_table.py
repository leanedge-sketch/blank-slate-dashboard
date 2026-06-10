#!/usr/bin/env python3
"""Verify LeanChem_Recommended_Products is reachable and CRUD works."""

from __future__ import annotations

import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend"))

from dotenv import load_dotenv

load_dotenv(ROOT / ".env", override=False)
load_dotenv(ROOT / "backend" / ".env", override=False)

SQL_PATH = ROOT / "docs" / "0006_lean_chem_recommended_products.sql"
GRANTS_PATH = ROOT / "docs" / "0006b_lean_chem_recommended_products_grants.sql"
TABLE = "LeanChem_Recommended_Products"


def table_exists() -> bool:
    from app.database.connection import get_supabase_service_client

    client = get_supabase_service_client()
    try:
        client.table(TABLE).select("Row_No").limit(0).execute()
        return True
    except Exception:
        return False


def apply_sql_via_psycopg(path: Path) -> bool:
    db_url = os.getenv("DATABASE_URL") or os.getenv("SUPABASE_DB_URL")
    if not db_url:
        return False
    try:
        import psycopg2
    except ImportError:
        print("psycopg2 not installed; cannot run SQL automatically.")
        return False

    sql = path.read_text(encoding="utf-8")
    conn = psycopg2.connect(db_url)
    conn.autocommit = True
    try:
        with conn.cursor() as cur:
            cur.execute(sql)
        return True
    finally:
        conn.close()


def verify_crud() -> None:
    from app.models.pms import LeanChemRecommendedProductCreate
    from app.services.lean_chem_recommended_products import (
        count_lean_chem_recommended_products,
        create_lean_chem_recommended_product,
        delete_lean_chem_recommended_product,
        list_lean_chem_recommended_products,
    )

    total = count_lean_chem_recommended_products()
    rows = list_lean_chem_recommended_products(limit=3)
    print(f"  list: total={total}, sample_rows={len(rows)}")

    created = create_lean_chem_recommended_product(
        LeanChemRecommendedProductCreate(
            product_name="__connectivity_test__",
            sector="Construction",
        )
    )
    print(f"  create: id={created.id}")
    delete_lean_chem_recommended_product(created.id)
    print("  delete: ok")


def main() -> None:
    if not table_exists():
        print(f"{TABLE} not found — attempting setup…")
        if apply_sql_via_psycopg(SQL_PATH):
            print(f"Created {TABLE} via DATABASE_URL.")
        else:
            print(f"\nPlease run this SQL in Supabase SQL Editor:\n  {SQL_PATH}\n")
            sys.exit(1)

    print(f"OK: {TABLE} exists in Supabase.")

    try:
        verify_crud()
        print("OK: backend service CRUD via /api/v1/pms/lean-chem-products")
    except Exception as exc:
        print(f"CRUD check failed: {exc}")
        print(f"If you see a permission error, run:\n  {GRANTS_PATH}")
        sys.exit(1)

    print("\nFrontend: PMS > LeanChem Products (/pms/products)")
    print("API routes: GET/POST /api/v1/pms/lean-chem-products")


if __name__ == "__main__":
    main()
