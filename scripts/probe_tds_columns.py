#!/usr/bin/env python3
"""Discover tds_data columns via PostgREST select probes."""

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

CANDIDATES = [
    "id",
    "created_at",
    "updated_at",
    "brand",
    "grade",
    "owner",
    "source",
    "specs",
    "metadata",
    "chemical_type_id",
    "product_name",
    "vendor",
    "tds_link",
    "name",
    "title",
    "chemical_id",
    "uuid_id",
    "chemical_full_data_id",
    "product_id",
    "description",
    "file_url",
    "document_url",
    "is_active",
]


def main() -> int:
    client = get_supabase_client()
    ok_cols: list[str] = []
    for col in CANDIDATES:
        try:
            client.table("tds_data").select(col).limit(0).execute()
            ok_cols.append(col)
            print(f"OK   {col}")
        except Exception as exc:
            msg = str(exc)
            if "PGRST204" in msg or "column" in msg.lower():
                print(f"MISS {col}")
            else:
                print(f"ERR  {col}: {msg[:160]}")
    print("\nPresent columns:", ", ".join(ok_cols) or "(none)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
