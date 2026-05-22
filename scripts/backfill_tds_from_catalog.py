#!/usr/bin/env python3
"""Populate tds_data from chemical_full_data when TDS is empty."""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend"))

from dotenv import load_dotenv

for env_path in (ROOT / ".env", ROOT / "backend" / ".env"):
    if env_path.exists():
        load_dotenv(env_path, override=False)

from app.services.pms_service import backfill_tds_from_chemical_catalog, count_tds


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    before = count_tds()
    print(f"tds_data rows before: {before}")

    result = backfill_tds_from_chemical_catalog(dry_run=args.dry_run)
    print(result)

    after = count_tds()
    print(f"tds_data rows after: {after}")
    return 0 if result.get("errors", 0) == 0 else 1


if __name__ == "__main__":
    raise SystemExit(main())
