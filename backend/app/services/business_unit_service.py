"""
Sales/CRM business units — loaded from Supabase ``business_units`` lookup table.
"""
from __future__ import annotations

import logging
import re
from typing import List, Optional, Tuple

logger = logging.getLogger(__name__)

FALLBACK_BUSINESS_UNITS: Tuple[str, ...] = (
    "Hayat",
    "Alhadi",
    "Bet-chem",
    "Barracoda",
    "Nyumb-Chem",
    "Synresins",
)

_NAME_RE = re.compile(r"\s+")


def normalize_business_unit_name(value: Optional[str]) -> Optional[str]:
    if value is None:
        return None
    name = _NAME_RE.sub(" ", str(value).strip())
    return name or None


def _dedupe_preserve_order(names: List[str]) -> List[str]:
    seen: set[str] = set()
    out: List[str] = []
    for name in names:
        key = name.casefold()
        if key in seen:
            continue
        seen.add(key)
        out.append(name)
    return out


def _client():
    from app.database.connection import get_supabase_client, get_supabase_service_client

    try:
        return get_supabase_service_client()
    except Exception:
        return get_supabase_client()


def list_sales_pipeline_business_units() -> List[str]:
    """Fetch business unit names from the lookup table, else the seeded fallback."""
    from app.database.connection import get_supabase_client

    try:
        supabase = get_supabase_client()
        table_variations = [
            ("business_units", "name"),
            ("Business_Unit", "Name"),
            ("Business_Unit", "name"),
        ]
        for table_name, column_name in table_variations:
            try:
                response = supabase.table(table_name).select(column_name).execute()
                units: List[str] = []
                for row in response.data or []:
                    value = row.get("Name") or row.get(column_name) or row.get("name")
                    normalized = normalize_business_unit_name(value)
                    if normalized:
                        units.append(normalized)
                if units:
                    return _dedupe_preserve_order(units)
            except Exception as exc:
                logger.debug(
                    "business_units probe failed for %s.%s: %s",
                    table_name,
                    column_name,
                    exc,
                )
                continue
    except Exception as exc:
        logger.warning("Could not load business_units table: %s", exc)

    return list(FALLBACK_BUSINESS_UNITS)


def allowed_sales_pipeline_business_units() -> List[str]:
    units = list_sales_pipeline_business_units()
    if units:
        return _dedupe_preserve_order([*units, *FALLBACK_BUSINESS_UNITS])
    return list(FALLBACK_BUSINESS_UNITS)


def validate_pipeline_business_unit(value: Optional[str]) -> None:
    """Raise ValueError when business_unit is not in the lookup / fallback list."""
    normalized = normalize_business_unit_name(value)
    if not normalized:
        return
    allowed = {u.casefold(): u for u in allowed_sales_pipeline_business_units()}
    if normalized.casefold() not in allowed:
        raise ValueError(
            "Invalid business unit "
            f"'{normalized}'. Choose one of: {', '.join(allowed.values())}."
        )


def create_business_unit(name: str) -> str:
    """Insert a new business unit and return the stored name."""
    normalized = normalize_business_unit_name(name)
    if not normalized:
        raise ValueError("Business unit name is required.")
    if len(normalized) > 80:
        raise ValueError("Business unit name must be 80 characters or fewer.")

    existing = {u.casefold(): u for u in allowed_sales_pipeline_business_units()}
    if normalized.casefold() in existing:
        return existing[normalized.casefold()]

    supabase = _client()
    try:
        response = (
            supabase.table("business_units")
            .insert({"name": normalized, "is_system": False})
            .execute()
        )
        rows = response.data or []
        if rows:
            stored = normalize_business_unit_name(rows[0].get("name")) or normalized
            return stored
    except Exception as exc:
        logger.warning("Could not insert business unit %r: %s", normalized, exc)
        message = str(exc)
        if "duplicate" in message.lower() or "unique" in message.lower():
            return normalized
        raise ValueError(
            "Could not save the new business unit. "
            "Confirm the business_units table exists (run migrations/011_business_units.sql)."
        ) from exc

    return normalized
