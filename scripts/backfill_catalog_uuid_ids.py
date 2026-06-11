#!/usr/bin/env python3
"""Assign uuid_id to Chemical_Master_Data rows that are missing one."""

from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend"))

from dotenv import load_dotenv

load_dotenv(ROOT / ".env", override=False)

from app.services.catalog_sync_service import backfill_all_catalog_uuid_ids


def main() -> None:
    result = backfill_all_catalog_uuid_ids()
    print(json.dumps(result, indent=2))
    if result.get("column_missing"):
        print(
            "\nuuid_id column is missing — run docs/0005_chemical_master_data_extend.sql "
            "then docs/0005d_backfill_chemical_uuid_id.sql in Supabase.",
            file=sys.stderr,
        )
        sys.exit(1)


if __name__ == "__main__":
    main()
