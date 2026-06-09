#!/usr/bin/env python3
"""Create LeanChem_Recommended_Products table if missing."""

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
TABLE = "LeanChem_Recommended_Products"


def table_exists() -> bool:
    from app.database.connection import get_supabase_service_client

    client = get_supabase_service_client()
    try:
        client.table(TABLE).select("Row_No").limit(0).execute()
        return True
    except Exception:
        return False


def apply_sql_via_psycopg() -> bool:
    db_url = os.getenv("DATABASE_URL") or os.getenv("SUPABASE_DB_URL")
    if not db_url:
        return False
    try:
        import psycopg2
    except ImportError:
        print("psycopg2 not installed; cannot run SQL automatically.")
        return False

    sql = SQL_PATH.read_text(encoding="utf-8")
    conn = psycopg2.connect(db_url)
    conn.autocommit = True
    try:
        with conn.cursor() as cur:
            cur.execute(sql)
        return True
    finally:
        conn.close()


def main() -> None:
    if table_exists():
        print(f"OK: {TABLE} already exists.")
        return

    print(f"{TABLE} not found — attempting setup…")
    if apply_sql_via_psycopg():
        print(f"Created {TABLE} via DATABASE_URL.")
        return

    print(f"\nPlease run this SQL in Supabase SQL Editor:\n  {SQL_PATH}\n")


if __name__ == "__main__":
    main()
