#!/usr/bin/env python3
"""
Backfill public.interactions from Telegram.

Modes:
  1) Bot queue (often empty if webhook already consumes updates):
       python scripts/backfill_telegram_to_interactions.py --dry-run

  2) Telegram Desktop export (full chat history):
       python scripts/backfill_telegram_to_interactions.py --export path/to/result.json --dry-run
       python scripts/backfill_telegram_to_interactions.py --export path/to/result.json --apply

Requires TELEGRAM_BOT_TOKEN in backend/.env or .env.local.bak for mode 1.
"""

from __future__ import annotations

import argparse
import json
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

from app.services.telegram_backfill_service import (  # noqa: E402
    backfill_from_bot_updates,
    backfill_from_export_file,
    backfill_requirements,
)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--export", help="Path to Telegram Desktop result.json")
    parser.add_argument(
        "--apply",
        action="store_true",
        help="Insert rows (default is dry-run preview only)",
    )
    args = parser.parse_args()
    dry_run = not args.apply

    print(json.dumps(backfill_requirements(), indent=2))
    print()

    if args.export:
        result = backfill_from_export_file(args.export, dry_run=dry_run)
    else:
        result = backfill_from_bot_updates(dry_run=dry_run)

    print(json.dumps(result, indent=2, default=str))
    if dry_run:
        print("\nDry-run only. Re-run with --apply to insert into public.interactions.")


if __name__ == "__main__":
    main()
