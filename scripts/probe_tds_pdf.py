#!/usr/bin/env python3
import json
import sys
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend"))
from dotenv import load_dotenv

load_dotenv(ROOT / ".env")
load_dotenv(ROOT / "backend" / ".env")

from app.config import settings
from app.database.connection import get_supabase_client, get_supabase_service_client

tid = "a7383b9e-2fb7-47ba-8934-67c062b17faa"
row = (
    get_supabase_client()
    .table("tds_data")
    .select("id, brand, metadata")
    .eq("id", tid)
    .single()
    .execute()
).data
meta = row["metadata"]
if isinstance(meta, str):
    meta = json.loads(meta)

print(json.dumps(meta, indent=2))
key = meta.get("tds_file_key")
base = settings.SUPABASE_URL.rstrip("/")
for label, url in [
    ("file_url", meta.get("file_url")),
    ("tds_file_url", meta.get("tds_file_url")),
    ("from_key", f"{base}/storage/v1/object/public/product-documents/{key}" if key else None),
]:
    if not url:
        print(f"{label}: (none)")
        continue
    try:
        req = urllib.request.Request(url, method="HEAD")
        with urllib.request.urlopen(req) as resp:
            print(f"{label}: OK {resp.status}")
    except Exception as e:
        print(f"{label}: FAIL {e}")

if key:
    try:
        data = (
            get_supabase_service_client()
            .storage.from_("product-documents")
            .download(key)
        )
        print(f"download via key: OK {len(data)} bytes")
    except Exception as e:
        print(f"download via key: FAIL {e}")
