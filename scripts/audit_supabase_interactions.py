#!/usr/bin/env python3
"""
Audit where CRM / May interactions live in Supabase.

Tables:
  - public.interactions  — primary CRM log (what the app UI lists)
  - public.conversation  — RAG memory (Q/A snippets; may hold older chats)

Run from repo root:
  cd backend && python ../scripts/audit_supabase_interactions.py
  cd backend && python ../scripts/audit_supabase_interactions.py --customer-id <uuid>
"""

from __future__ import annotations

import argparse
import os
import sys
from collections import defaultdict
from datetime import datetime
from pathlib import Path

# Load backend settings
BACKEND = Path(__file__).resolve().parents[1] / "backend"
sys.path.insert(0, str(BACKEND))

try:
    from dotenv import load_dotenv

    for env_path in (
        BACKEND / ".env",
        Path(__file__).resolve().parents[1] / ".env",
        Path(__file__).resolve().parents[1] / ".env.local.bak",
    ):
        if env_path.exists():
            load_dotenv(env_path)
            break
except ImportError:
    pass

from app.database.connection import get_supabase_service_client  # noqa: E402


def month_key(iso: str | None) -> str:
    if not iso:
        return "unknown"
    return iso[:7]  # YYYY-MM


def audit_interactions_table(customer_id: str | None) -> None:
    sb = get_supabase_service_client()
    query = sb.table("interactions").select(
        "id, customer_id, created_at, input_text, ai_response", count="exact"
    )
    if customer_id:
        query = query.eq("customer_id", customer_id)

    # Pull in pages (service role sees all rows)
    rows: list[dict] = []
    offset = 0
    page = 500
    total = None
    while True:
        resp = (
            query.order("created_at", desc=True)
            .range(offset, offset + page - 1)
            .execute()
        )
        batch = resp.data or []
        if total is None:
            total = getattr(resp, "count", None) or len(batch)
        rows.extend(batch)
        if len(batch) < page:
            break
        offset += page

    by_month: dict[str, int] = defaultdict(int)
    by_customer: dict[str, int] = defaultdict(int)
    for r in rows:
        by_month[month_key(r.get("created_at"))] += 1
        by_customer[str(r.get("customer_id") or "null")] += 1

    print("\n=== public.interactions ===")
    print(f"Total rows{' for customer' if customer_id else ''}: {len(rows)} (count={total})")
    print("By month (created_at):")
    for m in sorted(by_month.keys()):
        print(f"  {m}: {by_month[m]}")
    if not customer_id and by_customer:
        print(f"Distinct customers: {len(by_customer)}")
    may_rows = [r for r in rows if month_key(r.get("created_at")).endswith("-05")]
    print(f"May rows (any year, *-05): {len(may_rows)}")
    for r in may_rows[:5]:
        preview = (r.get("input_text") or r.get("ai_response") or "")[:80].replace("\n", " ")
        print(f"  - {r.get('created_at')} | {r.get('id')} | {preview}...")


def audit_conversation_table(customer_id: str | None) -> None:
    sb = get_supabase_service_client()
    # Omit `content` — exports can be 60k+ chars per row and cause MemoryError.
    select_cols = "id, metadata, created_at"
    rows: list[dict] = []
    if customer_id:
        offset = 0
        page = 500
        max_pages = 20
        for _ in range(max_pages):
            resp = (
                sb.table("conversation")
                .select(select_cols, count="exact")
                .eq("metadata->>customer_id", str(customer_id))
                .order("created_at", desc=True)
                .range(offset, offset + page - 1)
                .execute()
            )
            batch = resp.data or []
            rows.extend(batch)
            if len(batch) < page:
                break
            offset += page
    else:
        resp = (
            sb.table("conversation")
            .select(select_cols)
            .order("created_at", desc=True)
            .limit(2000)
            .execute()
        )
        rows = resp.data or []

    matched: list[dict] = []
    by_month: dict[str, int] = defaultdict(int)
    for r in rows:
        meta = r.get("metadata") or {}
        cid = meta.get("customer_id") if isinstance(meta, dict) else None
        if customer_id or cid:
            matched.append(r)
            by_month[month_key(r.get("created_at"))] += 1

    scope = f"customer_id={customer_id}" if customer_id else "with customer_id in metadata"
    print("\n=== public.conversation (RAG) ===")
    print(f"Rows scanned: {len(rows)} | Matching {scope}: {len(matched)}")
    print("By month (matching rows):")
    for m in sorted(by_month.keys()):
        print(f"  {m}: {by_month[m]}")
    may_rows = [r for r in matched if month_key(r.get("created_at")).endswith("-05")]
    print(f"May rows (any year, *-05): {len(may_rows)}")
    for r in may_rows[:5]:
        meta = r.get("metadata") or {}
        print(
            f"  - {r.get('created_at')} | meta.customer_id={meta.get('customer_id')} | id={r.get('id')}"
        )


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--customer-id", help="Filter to one customer UUID")
    args = parser.parse_args()
    print("Supabase URL:", os.getenv("SUPABASE_URL", "(not set)")[:40], "...")
    audit_interactions_table(args.customer_id)
    audit_conversation_table(args.customer_id)
    print(
        "\nNote: The CRM UI merges public.interactions + sales_pipeline only (not public.conversation). "
        "+ sales_pipeline.ai_interactions. Clear date filters on the customer page to see May rows."
    )


if __name__ == "__main__":
    main()
