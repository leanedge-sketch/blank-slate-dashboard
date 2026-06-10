#!/usr/bin/env python3
"""
Apply docs/0007_sales_pipeline_validation_optional_commercial.sql

Fixes: pipeline updates at Validation (and earlier) failing with
'business_model is required' when commercial fields are not filled yet.

Requires DATABASE_URL or SUPABASE_DB_URL (Postgres connection string from
Supabase Dashboard → Project Settings → Database).
"""

from __future__ import annotations

import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SQL_PATHS = [
    ROOT / "docs" / "0007_sales_pipeline_validation_optional_commercial.sql",
    ROOT / "docs" / "0008_drop_sales_pipeline_commercial_trigger.sql",
]


def main() -> None:
    db_url = os.getenv("DATABASE_URL") or os.getenv("SUPABASE_DB_URL")
    if not db_url:
        print(
            "Set DATABASE_URL (Supabase → Project Settings → Database → Connection string)\n"
            "or run these SQL files in Supabase SQL Editor:\n"
            + "\n".join(f"  {p}" for p in SQL_PATHS)
            + "\n\nDashboard: https://supabase.com/dashboard/project/_/sql/new"
        )
        sys.exit(1)

    try:
        import psycopg2
    except ImportError:
        print("Install psycopg2: pip install psycopg2-binary")
        sys.exit(1)

    conn = psycopg2.connect(db_url)
    conn.autocommit = True
    try:
        with conn.cursor() as cur:
            for path in SQL_PATHS:
                if path.exists():
                    cur.execute(path.read_text(encoding="utf-8"))
                    print(f"Applied {path.name}")
        print("OK: sales_pipeline Validation-stage rules updated.")
        print("You can update pipeline deals at Validation without business_model now.")
    finally:
        conn.close()


if __name__ == "__main__":
    from dotenv import load_dotenv

    load_dotenv(ROOT / ".env")
    load_dotenv(ROOT / "backend" / ".env")
    load_dotenv(ROOT / ".env.local.bak")
    main()
