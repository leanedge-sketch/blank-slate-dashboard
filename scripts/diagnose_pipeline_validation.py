#!/usr/bin/env python3
"""Find sales_pipeline rows that fail SalesPipeline pydantic validation."""

from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend"))

from dotenv import load_dotenv

for env_path in (ROOT / ".env", ROOT / "backend" / ".env"):
    if env_path.exists():
        load_dotenv(env_path, override=False)

from pydantic import ValidationError

from app.database.connection import get_supabase_client
from app.models.sales_pipeline import SalesPipeline
from app.services.sales_pipeline_service import normalize_pipeline_row_from_db


def main() -> int:
    client = get_supabase_client()
    resp = client.table("sales_pipeline").select("*").execute()
    rows = resp.data or []
    failures: list[tuple[str, str, str]] = []
    for row in rows:
        norm = normalize_pipeline_row_from_db(row)
        try:
            SalesPipeline(**norm)
        except ValidationError as e:
            pid = str(row.get("id", "?"))[:36]
            stage = str(row.get("stage", "?"))
            failures.append((pid, stage, str(e.errors()[0].get("msg", e))))

    print(f"Total rows: {len(rows)}")
    print(f"Validation failures: {len(failures)}")
    for pid, stage, msg in failures[:20]:
        print(f"  {pid}  stage={stage!r}  {msg}")
    if len(failures) > 20:
        print(f"  ... and {len(failures) - 20} more")
    return 1 if failures else 0


if __name__ == "__main__":
    raise SystemExit(main())
