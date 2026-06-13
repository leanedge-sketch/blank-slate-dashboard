"""
Cross-module catalog sync: chemical_full_data is the master product list.

When a product is created or updated in PMS, ensure:
  - uuid_id exists (required for Sales pipeline links)
  - a TDS row exists (links PMS → Stock → Sales via tds_id)
"""
from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional, Union
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
    for _ in range(6):
        try:
            response = (
                supabase.table(TABLE)
                .update({"uuid_id": new_uuid})
                .eq("Row_No", chemical_id)
                .is_("uuid_id", "null")
                .execute()
            )
            if response.data:
                return new_uuid
            # Row already has uuid_id (possibly set concurrently).
            chem = get_chemical_full_data_by_id(chemical_id)
            if chem and chem.uuid_id:
                return str(chem.uuid_id)
            return None
        except Exception as exc:
            msg = str(exc).lower()
            if "uuid_id" in msg or "pgrst204" in msg or "schema cache" in msg:
                logger.warning(
                    "uuid_id column not available on %s; skipping assignment for id %s",
                    TABLE,
                    chemical_id,
                )
                return None
            if "23505" in msg or "duplicate" in msg:
                new_uuid = str(uuid4())
                continue
            raise
    logger.warning("Could not assign unique uuid_id for catalog id %s", chemical_id)
    return None


def resolve_catalog_product_uuid(value: Union[str, int, UUID, None]) -> Optional[str]:
    """
    Map catalog Row_No or an existing uuid_id to the canonical uuid_id string.
    Used by CRM, Sales, and TDS when linking pipelines and interactions to PMS products.
    """
    if value is None or value == "":
        return None
    s = str(value).strip()
    if not s:
        return None
    try:
        UUID(s)
        return s
    except ValueError:
        pass
    try:
        catalog_id = int(s)
    except (TypeError, ValueError):
        return None
    assigned = ensure_catalog_uuid_id(catalog_id)
    if assigned:
        return assigned
    from app.services.chemical_master_data import get_chemical_master_data_by_id

    chem = get_chemical_master_data_by_id(catalog_id)
    if chem and chem.uuid_id:
        return str(chem.uuid_id)
    return None


def backfill_all_catalog_uuid_ids(limit: int = 10000) -> Dict[str, Any]:
    """
    Assign uuid_id to every catalog row that is missing one.
    Safe to run repeatedly; no-ops when the column is absent or all rows have UUIDs.
    """
    from app.services.chemical_master_data import list_chemical_master_data

    chemicals = list_chemical_master_data(limit=limit, offset=0)
    missing = [c for c in chemicals if c.id is not None and not c.uuid_id]
    if not missing:
        return {"total": len(chemicals), "missing_before": 0, "updated": 0}

    updated = 0
    column_missing = False
    for chem in missing:
        assigned = ensure_catalog_uuid_id(int(chem.id))
        if assigned:
            updated += 1
        elif not column_missing:
            from app.services.chemical_master_data import _probe_live_optional_columns
            from app.database.connection import get_supabase_service_client

            try:
                client = get_supabase_service_client()
            except RuntimeError:
                from app.database.connection import get_supabase_client

                client = get_supabase_client()
            if "uuid_id" not in _probe_live_optional_columns(client):
                column_missing = True
                break

    return {
        "total": len(chemicals),
        "missing_before": len(missing),
        "updated": updated,
        "column_missing": column_missing,
    }


def ensure_catalog_list_has_uuid_ids(chemicals: List[ChemicalFullData]) -> List[ChemicalFullData]:
    """Backfill missing uuid_id values once per process when a list response needs them."""
    if not chemicals or not any(c.id and not c.uuid_id for c in chemicals):
        return chemicals

    result = backfill_all_catalog_uuid_ids()
    if result.get("updated", 0) <= 0:
        return chemicals

    from app.services.pms_service import get_chemical_full_data_by_id

    refreshed: List[ChemicalFullData] = []
    for chem in chemicals:
        if chem.id and not chem.uuid_id:
            row = get_chemical_full_data_by_id(int(chem.id))
            refreshed.append(row if row else chem)
        else:
            refreshed.append(chem)
    return refreshed


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

    # TDS rows are added manually on TDS Master Data — do not auto-create from catalog.
    return {
        "catalog_id": chemical_id,
        "uuid_id": str(chem.uuid_id) if chem.uuid_id else None,
        "tds_id": None,
        "product_name": chem.product_name,
        "synced": True,
    }


def refresh_catalog_row(chemical_id: int) -> Optional[ChemicalFullData]:
    """Re-fetch catalog row after sync."""
    from app.services.pms_service import get_chemical_full_data_by_id

    sync_catalog_product_links(chemical_id)
    return get_chemical_full_data_by_id(chemical_id)
