#!/usr/bin/env python3
"""
Apply docs/0012_sales_pipeline_business_model.sql

Fixes: new row violates check constraint "sales_pipeline_business_model_check"
when business_model values (e.g. Manufacturer) exist in Business_Model but not
in the old static whitelist.
"""

from __future__ import annotations

import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SQL_PATH = ROOT / "docs" / "0012_sales_pipeline_business_model.sql"


def main() -> None:
    db_url = os.getenv("DATABASE_URL") or os.getenv("SUPABASE_DB_URL")
    if not db_url:
        print(
            "Set DATABASE_URL (Supabase → Project Settings → Database → Connection string)\n"
            f"or run in Supabase SQL Editor:\n  {SQL_PATH}\n"
        )
        sys.exit(1)

    try:
        import psycopg2
    except ImportError:
        print("Install psycopg2: pip install psycopg2-binary")
        sys.exit(1)

    if not SQL_PATH.exists():
        print(f"Missing migration file: {SQL_PATH}")
        sys.exit(1)

    conn = psycopg2.connect(db_url)
    conn.autocommit = True
    try:
        with conn.cursor() as cur:
            cur.execute(SQL_PATH.read_text(encoding="utf-8"))
        print("OK: sales_pipeline business_model check now follows Business_Model lookup.")
    finally:
        conn.close()


if __name__ == "__main__":
    from dotenv import load_dotenv

    load_dotenv(ROOT / ".env")
    load_dotenv(ROOT / "backend" / ".env")
    load_dotenv(ROOT / ".env.local.bak")
    main()
