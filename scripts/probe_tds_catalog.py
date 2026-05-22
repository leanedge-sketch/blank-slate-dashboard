#!/usr/bin/env python3
"""Probe tds_data vs chemical_full_data counts."""

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

client = get_supabase_client()
for table in (
    "tds_data",
    "chemical_full_data",
    "costing_pricing_data",
    "leanchem_products",
    "products",
):
    try:
        resp = client.table(table).select("id", count="exact").limit(1).execute()
        print(f"{table}: count={resp.count}")
    except Exception as exc:
        print(f"{table}: ERROR {exc}")
