#!/usr/bin/env python3
"""Fix stale temp file_url values on TDS records that have tds_file_url / tds_file_key."""

from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend"))

from dotenv import load_dotenv

load_dotenv(ROOT / ".env")
load_dotenv(ROOT / "backend" / ".env")

from app.database.connection import get_supabase_client
from app.services.file_service import normalize_tds_metadata, resolve_tds_document_url


def main() -> None:
    client = get_supabase_client()
    rows = (
        client.table("tds_data")
        .select("id, brand, metadata")
        .execute()
        .data
        or []
    )

    fixed = 0
    for row in rows:
        meta = row.get("metadata")
        if isinstance(meta, str):
            meta = json.loads(meta)
        if not isinstance(meta, dict):
            continue

        resolved = resolve_tds_document_url(meta)
        if not resolved:
            continue

        stale = meta.get("file_url")
        if stale == resolved and meta.get("tds_file_url") == resolved:
            continue
        if isinstance(stale, str) and "/tds_files/temp/" in stale:
            pass  # needs fix
        elif stale == resolved:
            continue

        updated = normalize_tds_metadata(meta)
        client.table("tds_data").update({"metadata": updated}).eq("id", row["id"]).execute()
        fixed += 1
        print(f"fixed {row['id'][:8]}… {row.get('brand') or ''}")

    print(f"Done. Updated {fixed} TDS record(s).")


if __name__ == "__main__":
    main()
