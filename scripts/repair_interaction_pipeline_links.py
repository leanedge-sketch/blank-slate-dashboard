#!/usr/bin/env python3
"""Relink stale interaction.pipeline_id values and backfill CRM snapshots."""

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

from app.services.crm_service import get_all_customers
from app.services.pipeline_crm_sync import (
    backfill_pipelines_from_customer_interactions,
    relink_stale_interactions_to_current_deals,
)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--customer-id", default=None)
    parser.add_argument("--limit", type=int, default=200)
    args = parser.parse_args()

    if args.customer_id:
        print("Relink:", relink_stale_interactions_to_current_deals(args.customer_id))
        print(
            "Backfill:",
            backfill_pipelines_from_customer_interactions(
                args.customer_id, use_ai=False, fast=True
            ),
        )
        return 0

    print("Global relink:", relink_stale_interactions_to_current_deals(limit=args.limit))
    customers = get_all_customers(limit=args.limit, offset=0)
    for customer in customers:
        cid = str(customer.customer_id)
        relink_stale_interactions_to_current_deals(cid, limit=50)
        backfill_pipelines_from_customer_interactions(cid, use_ai=False, fast=True)
    print(f"Processed {len(customers)} customers")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
