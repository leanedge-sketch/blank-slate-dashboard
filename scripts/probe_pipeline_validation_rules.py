#!/usr/bin/env python3
"""Probe whether Validation-stage pipeline inserts work without business_model."""

from __future__ import annotations

import json
import sys
import uuid
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend"))

from dotenv import load_dotenv

load_dotenv(ROOT / ".env")
load_dotenv(ROOT / "backend" / ".env")
load_dotenv(ROOT / ".env.local.bak")

from app.database.connection import get_supabase_service_client


def main() -> None:
    client = get_supabase_service_client()

    # Find any customer for FK
    cust = client.table("sales_pipeline").select("customer_id").limit(1).execute()
    customer_id = None
    if cust.data:
        customer_id = cust.data[0].get("customer_id")
    if not customer_id:
        crm = client.table("customers").select("customer_id").limit(1).execute()
        if crm.data:
            customer_id = crm.data[0].get("customer_id")
    if not customer_id:
        print("No customer_id found for probe insert")
        sys.exit(1)

    test_id = str(uuid.uuid4())
    payload = {
        "id": test_id,
        "customer_id": customer_id,
        "stage": "Validation",
        "amount": 100,
        "version_number": 1,
        "is_current_version": False,
    }

    print("Probing insert at Validation without business_model...")
    try:
        res = client.table("sales_pipeline").insert(payload).execute()
        print("INSERT OK — constraint allows Validation without business_model")
        client.table("sales_pipeline").delete().eq("id", test_id).execute()
        print("Cleaned up probe row.")
        return
    except Exception as e:
        err = str(e)
        print("INSERT FAILED:")
        print(err[:2000])
        if "Validation, Proposal, Confirmation, Closed" in err:
            print(
                "\n>>> Legacy TRIGGER still active on public.sales_pipeline."
            )
            print(
                ">>> Fix: Supabase Dashboard → SQL Editor → paste and Run:\n"
                "    docs/0008_drop_sales_pipeline_commercial_trigger.sql\n"
                ">>> Then re-run: python scripts/probe_pipeline_validation_rules.py"
            )
        elif "business_model" in err.lower():
            print("\n>>> business_model rule still blocking Validation-stage writes.")
        elif "business_model" in err.lower():
            print("\n>>> business_model rule still blocking Validation-stage writes.")


if __name__ == "__main__":
    main()
