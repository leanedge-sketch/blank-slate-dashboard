#!/usr/bin/env python3
"""Relink stale interaction.pipeline_id values and backfill CRM snapshots."""

from __future__ import annotations

import argparse
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend"))

from dotenv import load_dotenv

for env_path in (ROOT / ".env", ROOT / "backend" / ".env"):
    if env_path.exists():
        load_dotenv(env_path, override=False)

from app.services.crm_service import get_all_customers, get_customers_count
from app.services.pipeline_crm_sync import (
    backfill_pipelines_from_customer_interactions,
    relink_stale_interactions_to_current_deals,
)


def process_customer(customer_id: str) -> dict:
    relink = relink_stale_interactions_to_current_deals(customer_id, limit=200)
    backfill = backfill_pipelines_from_customer_interactions(
        customer_id, use_ai=False, fast=True
    )
    return {
        "customer_id": customer_id,
        "interactions_relinked": relink.get("interactions_relinked", 0),
        "stale_pipeline_ids": relink.get("stale_pipeline_ids", 0),
        "interactions_linked": backfill.get("interactions_linked", 0),
        "snapshots_upserted": backfill.get("snapshots_upserted", 0),
        "pipelines_updated": backfill.get("pipelines_updated", 0),
    }


def run_all_customers(*, batch_size: int = 20) -> dict:
    total_customers = get_customers_count()
    print(f"Total customers: {total_customers}", flush=True)
    print(f"Batch size: {batch_size}\n", flush=True)

    totals = {
        "customers_processed": 0,
        "interactions_relinked": 0,
        "interactions_linked": 0,
        "snapshots_upserted": 0,
        "pipelines_updated": 0,
        "batches": 0,
    }
    offset = 0
    batch_num = 0

    while offset < total_customers:
        batch_num += 1
        customers = get_all_customers(limit=batch_size, offset=offset)
        if not customers:
            break

        batch_relinked = 0
        batch_linked = 0
        batch_snapshots = 0
        batch_pipelines = 0

        print(f"--- Batch {batch_num} (offset {offset}, {len(customers)} customers) ---", flush=True)
        t0 = time.time()

        for customer in customers:
            cid = str(customer.customer_id)
            name = (customer.customer_name or cid)[:48]
            try:
                row = process_customer(cid)
                batch_relinked += row["interactions_relinked"]
                batch_linked += row["interactions_linked"]
                batch_snapshots += row["snapshots_upserted"]
                batch_pipelines += row["pipelines_updated"]
                if row["interactions_relinked"] or row["interactions_linked"]:
                    print(
                        f"  {name}: relinked={row['interactions_relinked']} "
                        f"linked={row['interactions_linked']} "
                        f"snapshots={row['snapshots_upserted']}",
                        flush=True,
                    )
            except Exception as exc:
                print(f"  {name}: ERROR {exc}", flush=True)

        elapsed = time.time() - t0
        totals["customers_processed"] += len(customers)
        totals["interactions_relinked"] += batch_relinked
        totals["interactions_linked"] += batch_linked
        totals["snapshots_upserted"] += batch_snapshots
        totals["pipelines_updated"] += batch_pipelines
        totals["batches"] = batch_num

        print(
            f"  Batch {batch_num} done in {elapsed:.1f}s — "
            f"relinked={batch_relinked}, linked={batch_linked}, "
            f"snapshots={batch_snapshots}, pipelines={batch_pipelines}\n",
            flush=True,
        )

        offset += len(customers)
        if len(customers) < batch_size:
            break

    return totals


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--customer-id", default=None)
    parser.add_argument(
        "--batch-size",
        type=int,
        default=20,
        help="Customers per batch when processing all (default: 20)",
    )
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

    totals = run_all_customers(batch_size=max(1, args.batch_size))
    print("=== Complete ===", flush=True)
    for key, value in totals.items():
        print(f"  {key}: {value}", flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
