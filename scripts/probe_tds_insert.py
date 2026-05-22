#!/usr/bin/env python3
"""Test tds_data insert payloads for chemical_id type."""

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
from app.services.pms_service import list_chemical_full_data


def main() -> int:
    client = get_supabase_client()
    chem = list_chemical_full_data(limit=1)[0]
    print(f"catalog id={chem.id} uuid={chem.uuid_id} name={chem.product_name!r}")

    attempts = [
        {"brand": "__probe_int__", "chemical_id": chem.id},
        {"brand": "__probe_uuid__", "chemical_id": str(chem.uuid_id) if chem.uuid_id else None},
        {"brand": "__probe_meta_only__", "metadata": {"chemical_full_data_id": chem.id}},
    ]

    for payload in attempts:
        if payload.get("chemical_id") is None and "metadata" not in payload:
            continue
        try:
            resp = client.table("tds_data").insert(payload).execute()
            row = resp.data[0]
            print(f"OK  {payload} -> id={row.get('id')} chemical_id={row.get('chemical_id')}")
            client.table("tds_data").delete().eq("id", row["id"]).execute()
            print("    (probe row deleted)")
        except Exception as exc:
            print(f"FAIL {payload}: {exc}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
