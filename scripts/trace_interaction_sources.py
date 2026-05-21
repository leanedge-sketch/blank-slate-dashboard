#!/usr/bin/env python3
"""
Trace where CRM interactions live: Supabase tables, Telegram config, ChatGPT exports.

  cd backend && python ../scripts/trace_interaction_sources.py --customer-id <uuid>
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

BACKEND = Path(__file__).resolve().parents[1] / "backend"
sys.path.insert(0, str(BACKEND))

try:
    from dotenv import load_dotenv

    for env_path in (
        BACKEND / ".env",
        Path(__file__).resolve().parents[1] / ".env.local.bak",
    ):
        if env_path.exists():
            load_dotenv(env_path)
            break
except ImportError:
    pass

from app.services.crm_service import (  # noqa: E402
    audit_customer_interaction_sources,
    get_customer_by_id,
)
from app.services.conversation_archive_service import (  # noqa: E402
    get_chatgpt_export_archives_for_customer,
)
from app.services.telegram_service import telegram_status  # noqa: E402


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--customer-id", help="Customer UUID (e.g. Mc-Bauchemie)")
    args = parser.parse_args()

    print("=== Telegram (this app) ===")
    status = telegram_status()
    for k, v in status.items():
        print(f"  {k}: {v}")

    if not args.customer_id:
        print("\nPass --customer-id to audit a customer (e.g. Mc-Bauchemie UUID).")
        return

    customer = get_customer_by_id(args.customer_id)
    if not customer:
        print(f"Customer not found: {args.customer_id}")
        sys.exit(1)

    print(f"\n=== Customer: {customer.customer_name} ({customer.customer_id}) ===")
    audit = audit_customer_interaction_sources(args.customer_id)
    for k, v in audit.items():
        if k != "customer_id":
            print(f"  {k}: {v}")

    gpt = get_chatgpt_export_archives_for_customer(
        args.customer_id, customer.customer_name, max_rows=10
    )
    print(f"\n=== Unlinked ChatGPT exports (conversations.json) mentioning name: {len(gpt)} ===")
    for row in gpt[:5]:
        meta = row.get("metadata") or {}
        print(
            f"  - {row.get('created_at')} file={meta.get('filename')} row={meta.get('row_index')}"
        )


if __name__ == "__main__":
    main()
