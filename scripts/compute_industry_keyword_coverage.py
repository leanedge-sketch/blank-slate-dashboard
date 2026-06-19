#!/usr/bin/env python3
from __future__ import annotations

"""
Compute how well simple keyword mapping fits existing Product_Type values.

This is a diagnostics-only script; it does not modify any data.
"""

from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend"))

from dotenv import load_dotenv

for env_path in (ROOT / ".env", ROOT / "backend" / ".env"):
    if env_path.exists():
        load_dotenv(env_path, override=False)

from app.database.connection import get_supabase_service_client, get_supabase_client


def main() -> int:
    try:
        client = get_supabase_service_client()
    except RuntimeError:
        client = get_supabase_client()

    resp = (
        client.table("Chemical_Master_Data")
        .select("Product_Type,Industry,Sector")
        .limit(50000)
        .execute()
    )
    rows = resp.data or []

    keywords = [
        (
            "Dry Mix mortar",
            ["dry mix", "mortar", "cement", "dry-mix"],
        ),
        (
            "Concrete admixture",
            ["concrete", "admixture", "admiture", "concerte"],
        ),
        (
            "Paint and Coating",
            [
                "paint",
                "coating",
                "acrylic",
                "epoxy",
                "resin",
                "pigment",
                "latex",
                "emulsion",
                "binder",
                "lacquer",
                "vinyl",
                "styrene",
                "polyester",
                "titanium dioxide",
                "tio2",
            ],
        ),
        (
            "Plastic",
            [
                "plastic",
                "polymer",
                "polyvinyl",
                "polyamide",
                "polyethylene",
                "polypropylene",
            ],
        ),
        (
            "Foam",
            ["foam", "foaming", "urethane foam", "polyurethane", "isocyanate"],
        ),
        (
            "Detergent",
            ["detergent", "soap", "surfactant", "clean", "cleaner"],
        ),
        (
            "Food",
            ["food", "edible", "starch", "sugar"],
        ),
        (
            "Pharmaceutical",
            ["pharmaceutical", "pharma", "medicine", "drug", "medical"],
        ),
    ]

    def classify(product_type: str, sector: str) -> str | None:
        t = (product_type or "").lower()
        s = (sector or "").lower()

        # 1) Strong keyword hits on Product_Type
        for canonical, kws in keywords:
            if any(k.lower() in t for k in kws):
                return canonical

        # 2) Heuristic fallbacks using Sector
        if "construction" in s:
            # Prefer dry mix when we see cement/mortar/dry words.
            if any(k in t for k in ("dry", "mortar", "cement", "dry mix")):
                return "Dry Mix mortar"
            return "Concrete admixture"

        if "coating" in s or "paint" in s:
            return "Paint and Coating"

        if "clean" in s or "personal" in s:
            return "Detergent"

        if "foam" in s:
            return "Foam"

        if "plastic" in s or "polymer" in s:
            return "Plastic"

        if "pharma" in s or "pharmaceutical" in s or "medicine" in s or "drug" in s:
            return "Pharmaceutical"

        if "food" in s:
            return "Food"

        # 3) Give up
        return None

    counts = {k: 0 for k, _ in keywords}
    unknown = 0
    for r in rows:
        pt = (r.get("Product_Type") or "").lower()
        sec = (r.get("Sector") or "").lower()
        matched = classify(pt, sec)
        if matched:
            counts[matched] = counts.get(matched, 0) + 1
        else:
            unknown += 1

    out = ROOT / "scripts" / "industry_keyword_coverage.txt"
    out.write_text(
        "\n".join(
            [
                f"TOTAL {len(rows)}",
                f"UNKNOWN {unknown}",
                *[f"{k}: {counts[k]}" for k, _ in keywords],
            ]
        ),
        encoding="utf-8",
    )
    print(f"Wrote {out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

