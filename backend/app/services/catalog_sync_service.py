"""
Cross-module catalog sync: chemical_full_data is the master product list.

When a product is created or updated in PMS, ensure:
  - uuid_id exists (required for Sales pipeline links)
  - a TDS row exists (links PMS → Stock → Sales via tds_id)
"""
from __future__ import annotations

import logging
from typing import Any, Dict, Optional
from uuid import UUID, uuid4

from app.database.connection import get_supabase_client
from app.models.pms import ChemicalFullData, Tds, TdsCreate

logger = logging.getLogger(__name__)


def ensure_catalog_uuid_id(chemical_id: int) -> Optional[str]:
    """Assign uuid_id when missing so Sales/CRM can link pipelines."""
    from app.services.pms_service import get_chemical_full_data_by_id

    chem = get_chemical_full_data_by_id(chemical_id)
    if not chem:
        return None
    if chem.uuid_id:
        return str(chem.uuid_id)

    from app.database.connection import get_supabase_service_client
    from app.services.chemical_master_data import TABLE

    new_uuid = str(uuid4())
    try:
        supabase = get_supabase_service_client()
    except RuntimeError:
        supabase = get_supabase_client()
    response = (
        supabase.table(TABLE)
        .update({"uuid_id": new_uuid})
        .eq("Row_No", chemical_id)
        .execute()
    )
    if not response.data:
        logger.warning("Failed to assign uuid_id for catalog id %s", chemical_id)
        return None
    return new_uuid


def _find_tds_for_catalog(chem: ChemicalFullData) -> Optional[Tds]:
    from app.services.pms_service import _tds_catalog_dedupe_key, list_tds

    product_name = (chem.product_name or "").strip()
    if not product_name:
        return None

    grade = (chem.sub_category or chem.packing or "").strip() or None
    dedupe = _tds_catalog_dedupe_key(product_name, grade)

    existing = list_tds(limit=5000, offset=0)
    for row in existing:
        meta = row.metadata if isinstance(row.metadata, dict) else {}
        catalog_id = meta.get("chemical_full_data_id")
        if catalog_id is not None:
            try:
                if int(catalog_id) == chem.id:
                    return row
            except (TypeError, ValueError):
                pass
        if _tds_catalog_dedupe_key(row.brand, row.grade) == dedupe:
            return row
    return None


def ensure_tds_for_catalog_product(chem: ChemicalFullData) -> Optional[Tds]:
    """Create tds_data for a catalog row when missing."""
    from app.services.pms_service import create_tds

    product_name = (chem.product_name or "").strip()
    if not product_name:
        return None

    existing = _find_tds_for_catalog(chem)
    if existing:
        return existing

    if not chem.uuid_id:
        return None

    grade = (chem.sub_category or chem.packing or "").strip() or None
    specs: Dict[str, Any] = {}
    if chem.product_category:
        specs["product_category"] = chem.product_category
    if chem.hs_code:
        specs["hs_code"] = chem.hs_code
    if chem.typical_application:
        specs["typical_application"] = chem.typical_application
    if chem.product_description:
        specs["product_description"] = chem.product_description

    body = TdsCreate(
        chemical_id=chem.uuid_id,
        brand=product_name,
        grade=grade,
        owner=(chem.vendor or "").strip() or None,
        source="chemical_full_data_catalog",
        specs=specs or None,
        metadata={
            "chemical_full_data_id": chem.id,
            "uuid_id": str(chem.uuid_id),
            "vendor": chem.vendor,
            "sector": chem.sector,
            "industry": chem.industry,
            "sync": "catalog_auto",
        },
    )
    try:
        return create_tds(body)
    except Exception as exc:
        logger.warning(
            "Auto TDS create failed for catalog id %s (%s): %s",
            chem.id,
            product_name,
            exc,
        )
        return None


def sync_catalog_product_links(chemical_id: int) -> Dict[str, Any]:
    """
    Run after catalog create/update so Sales, CRM, Stock, and Reports see the product.
    Returns link ids for logging and API responses.
    """
    from app.services.pms_service import get_chemical_full_data_by_id

    ensure_catalog_uuid_id(chemical_id)
    chem = get_chemical_full_data_by_id(chemical_id)
    if not chem:
        return {"catalog_id": chemical_id, "synced": False}

    tds = ensure_tds_for_catalog_product(chem)
    return {
        "catalog_id": chemical_id,
        "uuid_id": str(chem.uuid_id) if chem.uuid_id else None,
        "tds_id": str(tds.id) if tds else None,
        "product_name": chem.product_name,
        "synced": True,
    }


def refresh_catalog_row(chemical_id: int) -> Optional[ChemicalFullData]:
    """Re-fetch catalog row after sync."""
    from app.services.pms_service import get_chemical_full_data_by_id

    sync_catalog_product_links(chemical_id)
    return get_chemical_full_data_by_id(chemical_id)
