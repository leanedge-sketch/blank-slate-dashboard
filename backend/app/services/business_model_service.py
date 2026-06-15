"""
Sales pipeline business models — loaded from Supabase ``Business_Model`` lookup table.
"""
from __future__ import annotations

import logging
from typing import List, Optional

logger = logging.getLogger(__name__)

# Fallback when the lookup table is empty or unreachable (matches legacy CHECK + common rows).
_FALLBACK_SALES_PIPELINE_BUSINESS_MODELS = (
    "SEZ Import",
    "Local Stock",
    "Manufacturer",
    "Distributor",
    "Trader",
    "Agency",
)


def list_sales_pipeline_business_models() -> List[str]:
    """Fetch business model names from the Business_Model lookup table."""
    from app.database.connection import get_supabase_client

    try:
        supabase = get_supabase_client()
        table_variations = [
            ("Business_Model", "Name"),
            ("Business_Model", "name"),
            ("business_model", "Name"),
            ("business_model", "name"),
        ]
        for table_name, column_name in table_variations:
            try:
                response = supabase.table(table_name).select(column_name).execute()
                if not response.data:
                    continue
                models: List[str] = []
                for row in response.data:
                    value = row.get("Name") or row.get(column_name) or row.get("name")
                    if value and str(value).strip():
                        models.append(str(value).strip())
                if models:
                    # Stable order, deduped case-insensitively.
                    seen: set[str] = set()
                    out: List[str] = []
                    for m in models:
                        key = m.casefold()
                        if key in seen:
                            continue
                        seen.add(key)
                        out.append(m)
                    return out
            except Exception as exc:
                logger.debug(
                    "Business_Model probe failed for %s.%s: %s",
                    table_name,
                    column_name,
                    exc,
                )
                continue
    except Exception as exc:
        logger.warning("Could not load Business_Model table: %s", exc)

    return list(_FALLBACK_SALES_PIPELINE_BUSINESS_MODELS)


def allowed_sales_pipeline_business_models() -> List[str]:
    models = list_sales_pipeline_business_models()
    if models:
        return models
    return list(_FALLBACK_SALES_PIPELINE_BUSINESS_MODELS)


def validate_pipeline_business_model(value: Optional[str]) -> None:
    """Raise ValueError when business_model is not in the lookup table."""
    if value is None or not str(value).strip():
        return
    normalized = str(value).strip()
    allowed = {m.casefold(): m for m in allowed_sales_pipeline_business_models()}
    if normalized.casefold() not in allowed:
        raise ValueError(
            "Invalid business model "
            f"'{normalized}'. Choose one of: {', '.join(allowed.values())}."
        )
