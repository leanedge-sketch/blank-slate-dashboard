#!/usr/bin/env python3
"""Delete all rows from tds_data (empty TDS master catalog)."""

from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend"))

from dotenv import load_dotenv

load_dotenv(ROOT / ".env")
load_dotenv(ROOT / "backend" / ".env")

from app.database.connection import get_supabase_service_client


def main() -> None:
    client = get_supabase_service_client()
    before = client.table("tds_data").select("id", count="exact").execute()
    total = before.count or 0
    if total == 0:
        print("OK: tds_data is already empty.")
        return
    client.table("tds_data").delete().neq("id", "00000000-0000-0000-0000-000000000000").execute()
    after = client.table("tds_data").select("id", count="exact").execute()
    remaining = after.count or 0
    print(f"OK: removed {total - remaining} TDS row(s); {remaining} remaining.")


if __name__ == "__main__":
    main()
