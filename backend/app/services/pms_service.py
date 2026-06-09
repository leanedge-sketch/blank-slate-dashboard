"""
PMS Service - Business Logic Layer
==================================

This file contains the "business logic" for Product Management System (PMS)
operations on top of Supabase:
- chemical_full_data (catalog; legacy name chemical_types in API)
- tds_data
- partner_data
- leanchem_products
- costing_pricing_data
"""

from typing import List, Optional, Dict, Any
import json
import re
from uuid import UUID

from supabase import Client

from app.database.connection import get_supabase_client
from app.services.ai_service import gemini_chat
from app.services.file_service import extract_text_from_file
from app.models.pms import (
    ChemicalType,
    ChemicalTypeCreate,
    ChemicalTypeUpdate,
    Tds,
    TdsCreate,
    TdsUpdate,
    Partner,
    PartnerCreate,
    PartnerUpdate,
    LeanchemProduct,
    LeanchemProductCreate,
    LeanchemProductUpdate,
    CostingPricing,
    CostingPricingCreate,
    CostingPricingUpdate,
    PartnerChemical,
    PartnerChemicalCreate,
    PartnerChemicalUpdate,
    ChemicalFullData,
    ChemicalFullDataCreate,
    ChemicalFullDataUpdate,
)


# =============================
# CHEMICAL TYPES
# =============================


def list_chemical_types(limit: int = 100, offset: int = 0) -> List[ChemicalType]:
    """
    Return "chemical types" for the PMS UI.

    Originally this read from the `chemical_types` table (UUID PK).
    We now use `chemical_full_data` as the master product table and
    adapt its columns to the existing `ChemicalType` model:

      - id           ← chemical_full_data.id (integer)
      - name         ← product_name
      - category     ← product_category
      - hs_code      ← hs_code
      - metadata     ← { vendor, sub_category, packing,
                         typical_application, product_description, price }

    This keeps the API contract stable for the frontend while pointing
    at the new data source.
    """
    try:
        chemicals = list_chemical_full_data(limit=limit, offset=offset)
        adapted_rows: List[Dict[str, Any]] = []
        for chem in chemicals:
            row_dict = chem.model_dump()
            adapted_rows.append(
                {
                    "id": row_dict.get("id"),
                    "name": row_dict.get("product_name") or "",
                    "category": row_dict.get("product_category"),
                    "hs_code": row_dict.get("hs_code"),
                    "applications": None,
                    "spec_template": None,
                    "metadata": {
                        "vendor": row_dict.get("vendor"),
                        "sub_category": row_dict.get("sub_category"),
                        "packing": row_dict.get("packing"),
                        "typical_application": row_dict.get("typical_application"),
                        "product_description": row_dict.get("product_description"),
                        "price": row_dict.get("price"),
                        "chemical_full_data_id": row_dict.get("id"),
                        "uuid_id": (
                            str(row_dict["uuid_id"])
                            if row_dict.get("uuid_id")
                            else None
                        ),
                    },
                    "created_at": None,
                }
            )

        return [ChemicalType(**row) for row in adapted_rows]
    except Exception as e:
        error_msg = str(e)
        error_type = type(e).__name__
        raise RuntimeError(
            f"Error fetching chemical_types ({error_type}): {error_msg}"
        ) from e


def count_chemical_types() -> int:
    return count_chemical_full_data()


def create_chemical_type(body: ChemicalTypeCreate) -> ChemicalType:
    """
    Create a new record in `chemical_full_data` corresponding to a ChemicalType.

    We map the high-level fields:
      name      → product_name
      category  → product_category
      hs_code   → hs_code

    Other fields (applications/spec_template/metadata) are currently ignored.
    """
    payload = body.model_dump(exclude_unset=True)
    from app.models.pms import ChemicalFullDataCreate

    created_row = create_chemical_full_data(
        ChemicalFullDataCreate(
            product_name=payload.get("name"),
            product_category=payload.get("category"),
            hs_code=payload.get("hs_code"),
        )
    )
    created = created_row.model_dump()

    adapted = {
        "id": created.get("id"),
        "name": created.get("product_name") or "",
        "category": created.get("product_category"),
        "hs_code": created.get("hs_code"),
        "applications": None,
        "spec_template": None,
        "metadata": {
            "vendor": created.get("vendor"),
            "sub_category": created.get("sub_category"),
            "packing": created.get("packing"),
            "typical_application": created.get("typical_application"),
            "product_description": created.get("product_description"),
            "price": created.get("price"),
            "chemical_full_data_id": created.get("id"),
            "uuid_id": (
                str(created["uuid_id"]) if created.get("uuid_id") else None
            ),
        },
        "created_at": None,
    }
    return ChemicalType(**adapted)


def get_chemical_type_by_id(chemical_id: str) -> Optional[ChemicalType]:
    chem = get_chemical_full_data_by_id(int(chemical_id))
    if chem:
        row = chem.model_dump()
        adapted = {
            "id": row.get("id"),
            "name": row.get("product_name") or "",
            "category": row.get("product_category"),
            "hs_code": row.get("hs_code"),
            "applications": None,
            "spec_template": None,
            "metadata": {
                "vendor": row.get("vendor"),
                "sub_category": row.get("sub_category"),
                "packing": row.get("packing"),
                "typical_application": row.get("typical_application"),
                "product_description": row.get("product_description"),
                "price": row.get("price"),
                "chemical_full_data_id": row.get("id"),
                "uuid_id": (
                    str(row["uuid_id"]) if row.get("uuid_id") else None
                ),
            },
            "created_at": None,
        }
        return ChemicalType(**adapted)
    return None


def update_chemical_type(chemical_id: str, body: ChemicalTypeUpdate) -> ChemicalType:
    existing = get_chemical_type_by_id(chemical_id)
    if not existing:
        raise ValueError("Chemical type not found")

    update_data = body.model_dump(exclude_unset=True)
    if not update_data:
        return existing

    from app.models.pms import ChemicalFullDataUpdate

    mapped = ChemicalFullDataUpdate()
    if "name" in update_data:
        mapped.product_name = update_data["name"]
    if "category" in update_data:
        mapped.product_category = update_data["category"]
    if "hs_code" in update_data:
        mapped.hs_code = update_data["hs_code"]

    if not mapped.model_dump(exclude_unset=True):
        return existing

    updated = update_chemical_full_data(int(chemical_id), mapped)
    row = updated.model_dump()
    adapted = {
        "id": row.get("id"),
        "name": row.get("product_name") or "",
        "category": row.get("product_category"),
        "hs_code": row.get("hs_code"),
        "applications": None,
        "spec_template": None,
        "metadata": {
            "vendor": row.get("vendor"),
            "sub_category": row.get("sub_category"),
            "packing": row.get("packing"),
            "typical_application": row.get("typical_application"),
            "product_description": row.get("product_description"),
            "price": row.get("price"),
        },
        "created_at": None,
    }
    return ChemicalType(**adapted)


def delete_chemical_type(chemical_id: str) -> bool:
    return delete_chemical_full_data(int(chemical_id))


# =============================
# TDS DATA
# =============================


def _resolve_catalog_uuid_for_tds(chemical_ref: Optional[str]) -> Optional[str]:
    """Map catalog integer id or uuid string to chemical_full_data.uuid_id."""
    if not chemical_ref:
        return None
    ref = str(chemical_ref).strip()
    if not ref:
        return None
    try:
        UUID(ref)
        return ref
    except ValueError:
        pass
    try:
        chem = get_chemical_type_by_id(ref)
        if chem and chem.metadata and chem.metadata.get("uuid_id"):
            return str(chem.metadata["uuid_id"])
    except (TypeError, ValueError):
        return None
    return None


def _prepare_tds_db_payload(payload: Dict[str, Any]) -> Dict[str, Any]:
    """Strip API-only fields and map chemical_type_id -> chemical_id for tds_data."""
    data = dict(payload)
    ref = data.pop("chemical_type_id", None)
    if ref is not None:
        resolved = _resolve_catalog_uuid_for_tds(str(ref))
        if resolved:
            data["chemical_id"] = resolved
    elif data.get("chemical_id") is not None:
        resolved = _resolve_catalog_uuid_for_tds(str(data["chemical_id"]))
        if resolved:
            data["chemical_id"] = resolved
    return data


def _tds_from_row(row: Dict[str, Any]) -> Tds:
    """Normalize DB row (chemical_id) to API model (chemical_type_id alias)."""
    normalized = dict(row)
    chem_id = normalized.get("chemical_id")
    if chem_id and not normalized.get("chemical_type_id"):
        normalized["chemical_type_id"] = chem_id
    return Tds(**normalized)


def list_tds(
    limit: int = 100,
    offset: int = 0,
    brand: Optional[str] = None,
    grade: Optional[str] = None,
    owner: Optional[str] = None,
    chemical_type_id: Optional[str] = None,
) -> List[Tds]:
    supabase: Client = get_supabase_client()
    query = supabase.table("tds_data").select("*")

    if brand:
        query = query.ilike("brand", f"%{brand}%")
    if grade:
        query = query.ilike("grade", f"%{grade}%")
    if owner:
        query = query.ilike("owner", f"%{owner}%")
    if chemical_type_id:
        cid = str(chemical_type_id).strip()
        catalog_uuid = _resolve_catalog_uuid_for_tds(cid)
        if catalog_uuid:
            query = query.eq("chemical_id", catalog_uuid)
        else:
            try:
                query = query.eq("metadata->>chemical_full_data_id", cid)
            except Exception:
                chem = get_chemical_type_by_id(cid)
                if chem and chem.name:
                    query = query.ilike("brand", f"%{chem.name}%")

    response = (
        query.order("created_at", desc=True)
        .limit(limit)
        .offset(offset)
        .execute()
    )
    return [_tds_from_row(row) for row in (response.data or [])]


def count_tds() -> int:
    supabase: Client = get_supabase_client()
    response = supabase.table("tds_data").select("id", count="exact").execute()
    return response.count or 0


def _tds_catalog_dedupe_key(brand: Optional[str], grade: Optional[str]) -> str:
    return f"{(brand or '').strip().lower()}|{(grade or '').strip().lower()}"


def backfill_tds_from_chemical_catalog(
    *,
    dry_run: bool = False,
    page_size: int = 200,
) -> Dict[str, Any]:
    """
    Create tds_data rows from chemical_full_data when the TDS table is empty or incomplete.
    One TDS per catalog product (deduped by catalog id / brand+grade).
    """
    existing = list_tds(limit=5000, offset=0)
    by_catalog_id: Dict[int, Tds] = {}
    by_key: Dict[str, Tds] = {}
    for row in existing:
        meta = row.metadata if isinstance(row.metadata, dict) else {}
        catalog_id = meta.get("chemical_full_data_id")
        if catalog_id is not None:
            try:
                by_catalog_id[int(catalog_id)] = row
            except (TypeError, ValueError):
                pass
        by_key[_tds_catalog_dedupe_key(row.brand, row.grade)] = row

    created = 0
    skipped = 0
    errors = 0
    offset = 0
    catalog_total = 0

    while True:
        batch = list_chemical_full_data(limit=page_size, offset=offset)
        if not batch:
            break
        catalog_total += len(batch)
        for chem in batch:
            product_name = (chem.product_name or "").strip()
            if not product_name:
                skipped += 1
                continue
            if chem.id in by_catalog_id:
                skipped += 1
                continue
            grade = (chem.sub_category or chem.packing or "").strip() or None
            dedupe = _tds_catalog_dedupe_key(product_name, grade)
            if dedupe in by_key:
                skipped += 1
                continue

            specs: Dict[str, Any] = {}
            if chem.product_category:
                specs["product_category"] = chem.product_category
            if chem.hs_code:
                specs["hs_code"] = chem.hs_code
            if chem.typical_application:
                specs["typical_application"] = chem.typical_application
            if chem.product_description:
                specs["product_description"] = chem.product_description

            if not chem.uuid_id:
                errors += 1
                continue

            body = TdsCreate(
                chemical_id=chem.uuid_id,
                brand=product_name,
                grade=grade,
                owner=(chem.vendor or "").strip() or None,
                source="chemical_full_data_catalog",
                specs=specs or None,
                metadata={
                    "chemical_full_data_id": chem.id,
                    "uuid_id": str(chem.uuid_id) if chem.uuid_id else None,
                    "vendor": chem.vendor,
                    "sector": chem.sector,
                    "industry": chem.industry,
                    "backfill": "catalog_sync",
                },
            )

            if dry_run:
                created += 1
                continue

            try:
                tds = create_tds(body)
                by_catalog_id[chem.id] = tds
                by_key[dedupe] = tds
                created += 1
            except Exception as exc:
                errors += 1
                import logging

                logging.getLogger(__name__).warning(
                    "TDS backfill failed for catalog id %s (%s): %s",
                    chem.id,
                    product_name,
                    exc,
                )

        if len(batch) < page_size:
            break
        offset += page_size

    return {
        "dry_run": dry_run,
        "catalog_products_scanned": catalog_total,
        "existing_tds": len(existing),
        "created": created,
        "skipped": skipped,
        "errors": errors,
        "tds_total_after": len(existing) + (0 if dry_run else created),
    }


def create_tds(body: TdsCreate) -> Tds:
    supabase: Client = get_supabase_client()
    payload = _prepare_tds_db_payload(body.model_dump(exclude_unset=True))

    # Convert ALL UUIDs in the entire payload to strings (Supabase needs strings)
    def convert_uuids(obj):
        """Recursively convert UUID objects to strings for JSON serialization."""
        if isinstance(obj, UUID):
            return str(obj)
        elif isinstance(obj, dict):
            return {k: convert_uuids(v) for k, v in obj.items()}
        elif isinstance(obj, list):
            return [convert_uuids(item) for item in obj]
        elif isinstance(obj, tuple):
            return tuple(convert_uuids(item) for item in obj)
        return obj
    
    # Convert all UUIDs in the entire payload
    payload = convert_uuids(payload)
    
    response = supabase.table("tds_data").insert(payload).execute()
    if not response.data:
        raise RuntimeError("Failed to create TDS record")
    return _tds_from_row(response.data[0])


def get_tds_by_id(tds_id: str) -> Optional[Tds]:
    supabase: Client = get_supabase_client()
    response = (
        supabase.table("tds_data")
        .select("*")
        .eq("id", tds_id)
        .single()
        .execute()
    )
    if response.data:
        return _tds_from_row(response.data)
    return None


def update_tds(tds_id: str, body: TdsUpdate) -> Tds:
    supabase: Client = get_supabase_client()
    existing = get_tds_by_id(tds_id)
    if not existing:
        raise ValueError("TDS record not found")
    
    update_data = _prepare_tds_db_payload(body.model_dump(exclude_unset=True))
    if not update_data:
        return existing

    def convert_uuids(obj):
        """Recursively convert UUID objects to strings for JSON serialization."""
        if isinstance(obj, UUID):
            return str(obj)
        elif isinstance(obj, dict):
            return {k: convert_uuids(v) for k, v in obj.items()}
        elif isinstance(obj, list):
            return [convert_uuids(item) for item in obj]
        elif isinstance(obj, tuple):
            return tuple(convert_uuids(item) for item in obj)
        return obj
    
    update_data = convert_uuids(update_data)
    
    response = (
        supabase.table("tds_data")
        .update(update_data)
        .eq("id", tds_id)
        .execute()
    )
    if not response.data:
        raise RuntimeError("Failed to update TDS record")
    return _tds_from_row(response.data[0])


def delete_tds(tds_id: str) -> bool:
    supabase: Client = get_supabase_client()
    response = (
        supabase.table("tds_data")
        .delete()
        .eq("id", tds_id)
        .execute()
    )
    return True


# =============================
# PARTNER DATA
# =============================


def list_partners(
    limit: int = 100,
    offset: int = 0,
    partner_name: Optional[str] = None,
) -> List[Partner]:
    supabase: Client = get_supabase_client()
    query = supabase.table("partner_data").select("*")
    if partner_name:
        query = query.ilike("partner", f"%{partner_name}%")
    response = (
        query.order("partner", desc=False)
        .limit(limit)
        .offset(offset)
        .execute()
    )
    return [Partner(**row) for row in (response.data or [])]


def count_partners() -> int:
    supabase: Client = get_supabase_client()
    response = supabase.table("partner_data").select("id", count="exact").execute()
    return response.count or 0


def create_partner(body: PartnerCreate) -> Partner:
    supabase: Client = get_supabase_client()
    payload = body.model_dump(exclude_unset=True)
    response = supabase.table("partner_data").insert(payload).execute()
    if not response.data:
        raise RuntimeError("Failed to create partner")
    return Partner(**response.data[0])


def get_partner_by_id(partner_id: str) -> Optional[Partner]:
    supabase: Client = get_supabase_client()
    response = (
        supabase.table("partner_data")
        .select("*")
        .eq("id", partner_id)
        .single()
        .execute()
    )
    if response.data:
        return Partner(**response.data)
    return None


def update_partner(partner_id: str, body: PartnerUpdate) -> Partner:
    supabase: Client = get_supabase_client()
    existing = get_partner_by_id(partner_id)
    if not existing:
        raise ValueError("Partner not found")
    
    update_data = body.model_dump(exclude_unset=True)
    if not update_data:
        return existing
    
    response = (
        supabase.table("partner_data")
        .update(update_data)
        .eq("id", partner_id)
        .execute()
    )
    if not response.data:
        raise RuntimeError("Failed to update partner")
    return Partner(**response.data[0])


def delete_partner(partner_id: str) -> bool:
    supabase: Client = get_supabase_client()
    response = (
        supabase.table("partner_data")
        .delete()
        .eq("id", partner_id)
        .execute()
    )
    return True


# =============================
# LEANCHEM PRODUCTS
# =============================


def list_leanchem_products(
    limit: int = 100,
    offset: int = 0,
    category: Optional[str] = None,
    product_type: Optional[str] = None,
    tds_id: Optional[str] = None,
) -> List[LeanchemProduct]:
    supabase: Client = get_supabase_client()
    query = supabase.table("leanchem_products").select("*")

    if category:
        query = query.ilike("category", f"%{category}%")
    if product_type:
        query = query.ilike("product_type", f"%{product_type}%")
    if tds_id:
        query = query.eq("tds_id", tds_id)

    response = (
        query.order("created_at", desc=True)
        .limit(limit)
        .offset(offset)
        .execute()
    )
    return [LeanchemProduct(**row) for row in (response.data or [])]


def count_leanchem_products() -> int:
    supabase: Client = get_supabase_client()
    response = supabase.table("leanchem_products").select("id", count="exact").execute()
    return response.count or 0


def create_leanchem_product(body: LeanchemProductCreate) -> LeanchemProduct:
    supabase: Client = get_supabase_client()
    from uuid import UUID

    def _uuidify(obj: Any) -> Any:
        if isinstance(obj, UUID):
            return str(obj)
        if isinstance(obj, dict):
            return {k: _uuidify(v) for k, v in obj.items()}
        if isinstance(obj, list):
            return [_uuidify(i) for i in obj]
        return obj

    payload = _uuidify(body.model_dump(exclude_unset=True))
    response = supabase.table("leanchem_products").insert(payload).execute()
    if not response.data:
        raise RuntimeError("Failed to create LeanChem product")
    return LeanchemProduct(**response.data[0])


def get_leanchem_product_by_id(product_id: str) -> Optional[LeanchemProduct]:
    supabase: Client = get_supabase_client()
    response = (
        supabase.table("leanchem_products")
        .select("*")
        .eq("id", product_id)
        .single()
        .execute()
    )
    if response.data:
        return LeanchemProduct(**response.data)
    return None


def update_leanchem_product(product_id: str, body: LeanchemProductUpdate) -> LeanchemProduct:
    supabase: Client = get_supabase_client()
    existing = get_leanchem_product_by_id(product_id)
    if not existing:
        raise ValueError("Product not found")
    
    update_data = body.model_dump(exclude_unset=True)
    if not update_data:
        return existing
    
    response = (
        supabase.table("leanchem_products")
        .update(update_data)
        .eq("id", product_id)
        .execute()
    )
    if not response.data:
        raise RuntimeError("Failed to update product")
    return LeanchemProduct(**response.data[0])


def delete_leanchem_product(product_id: str) -> bool:
    supabase: Client = get_supabase_client()
    response = (
        supabase.table("leanchem_products")
        .delete()
        .eq("id", product_id)
        .execute()
    )
    return True


# =============================
# COSTING / PRICING DATA
# =============================


def list_costing_pricing(
    limit: int = 100,
    offset: int = 0,
    partner_id: Optional[str] = None,
    tds_id: Optional[str] = None,
) -> List[CostingPricing]:
    supabase: Client = get_supabase_client()
    query = supabase.table("costing_pricing_data").select("*")

    if partner_id:
        query = query.eq("partner_id", partner_id)
    if tds_id:
        query = query.eq("tds_id", tds_id)

    response = (
        query.order("created_at", desc=True)
        .limit(limit)
        .offset(offset)
        .execute()
    )
    return [CostingPricing(**row) for row in (response.data or [])]


def count_costing_pricing() -> int:
    supabase: Client = get_supabase_client()
    response = (
        supabase.table("costing_pricing_data")
        .select("partner_id", count="exact")
        .execute()
    )
    return response.count or 0


def create_costing_pricing(body: CostingPricingCreate) -> CostingPricing:
    supabase: Client = get_supabase_client()
    payload = body.model_dump(exclude_unset=True)
    response = supabase.table("costing_pricing_data").insert(payload).execute()
    if not response.data:
        raise RuntimeError("Failed to create costing/pricing record")
    return CostingPricing(**response.data[0])


def get_costing_pricing_by_ids(partner_id: str, tds_id: str) -> Optional[CostingPricing]:
    supabase: Client = get_supabase_client()
    response = (
        supabase.table("costing_pricing_data")
        .select("*")
        .eq("partner_id", partner_id)
        .eq("tds_id", tds_id)
        .single()
        .execute()
    )
    if response.data:
        return CostingPricing(**response.data)
    return None


def update_costing_pricing(partner_id: str, tds_id: str, body: CostingPricingUpdate) -> CostingPricing:
    supabase: Client = get_supabase_client()
    existing = get_costing_pricing_by_ids(partner_id, tds_id)
    if not existing:
        raise ValueError("Pricing record not found")
    
    update_data = body.model_dump(exclude_unset=True)
    if not update_data:
        return existing
    
    response = (
        supabase.table("costing_pricing_data")
        .update(update_data)
        .eq("partner_id", partner_id)
        .eq("tds_id", tds_id)
        .execute()
    )
    if not response.data:
        raise RuntimeError("Failed to update pricing record")
    return CostingPricing(**response.data[0])


def delete_costing_pricing(partner_id: str, tds_id: str) -> bool:
    supabase: Client = get_supabase_client()
    response = (
        supabase.table("costing_pricing_data")
        .delete()
        .eq("partner_id", partner_id)
        .eq("tds_id", tds_id)
        .execute()
    )
    return True


 # =============================
 # AI FUNCTIONS FOR TDS EXTRACTION
 # =============================


def _parse_lenient_json(text: str) -> Optional[Dict[str, Any]]:
    """Try to parse JSON from text, handling various formats."""
    if not text:
        return None
    
    # Try direct JSON parse
    try:
        return json.loads(text)
    except Exception:
        pass
    
    # Try to extract JSON object from text
    json_match = re.search(r'\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}', text, re.DOTALL)
    if json_match:
        try:
            return json.loads(json_match.group(0))
        except Exception:
            pass
    
    return None


def extract_tds_info_with_ai(text_content: str) -> Optional[Dict[str, Any]]:
    """
    Use Gemini AI to extract TDS information from text content.
    
    Returns a dictionary with extracted fields:
    - generic_product_name
    - trade_name
    - supplier_name
    - packaging_size_type
    - net_weight
    - hs_code
    - technical_specification
    """
    try:
        prompt = f"""
Extract the following information from this Technical Data Sheet (TDS) text. 
Return the information in a structured JSON format. If any information is not found, use empty string.

Text content:
{text_content[:10000]}  # Limit to avoid token limits

Please extract and return ONLY a JSON object with these exact keys:
{{
    "generic_product_name": "[extract generic product name]",
    "trade_name": "[extract trade name or model name]",
    "supplier_name": "[extract supplier or manufacturer name]",
    "packaging_size_type": "[extract packaging information]",
    "net_weight": "[extract net weight]",
    "hs_code": "[extract HS code]",
    "technical_specification": "[extract key technical specifications]"
}}

Return ONLY valid JSON, no other text.
"""
        
        messages = [
            {
                "role": "system",
                "content": "You are a helpful assistant that extracts structured data from Technical Data Sheets. Always return valid JSON only."
            },
            {
                "role": "user",
                "content": prompt
            }
        ]
        
        response_text = gemini_chat(messages)
        
        if not response_text:
            return None
        
        # Try to parse JSON from response
        parsed_json = _parse_lenient_json(response_text)
        if isinstance(parsed_json, dict):
            return parsed_json
        
        # Fallback: parse "Key: Value" lines
        extracted_info = {}
        lines = response_text.split('\n')
        for line in lines:
            if ':' in line:
                parts = line.split(':', 1)
                if len(parts) == 2:
                    key = parts[0].strip().lower().replace(' ', '_').replace('-', '_')
                    value = parts[1].strip()
                    if key and value and value.lower() != "not found":
                        extracted_info[key] = value
        
        return extracted_info if extracted_info else None
        
    except Exception as e:
        print(f"AI extraction error: {str(e)}")
        return None


def generate_product_description_with_ai(
    text_content: str, extracted_info: Dict[str, Any]
) -> Optional[str]:
    """Generate a short product summary from TDS text and extracted fields."""
    try:
        product_name = (
            extracted_info.get("generic_product_name")
            or extracted_info.get("trade_name")
            or "this product"
        )
        trade_name = extracted_info.get("trade_name") or ""
        supplier = extracted_info.get("supplier_name") or ""
        specs = extracted_info.get("technical_specification") or ""

        prompt = f"""
Write a concise 2-3 sentence product description for a chemical/material catalog entry.
Focus on what the product is, its main use, and one notable property if known.
Do not use bullet points. Plain prose only.

Product name: {product_name}
Trade name: {trade_name}
Supplier: {supplier}
Technical notes: {specs[:1500]}

TDS excerpt:
{text_content[:4000]}
"""
        messages = [
            {
                "role": "system",
                "content": "You write clear, professional product descriptions for industrial chemical catalogs.",
            },
            {"role": "user", "content": prompt},
        ]
        response_text = gemini_chat(messages)
        if response_text:
            return response_text.strip()
    except Exception as e:
        print(f"AI description error: {str(e)}")
    return None


def process_tds_file_with_ai(file_content: bytes, filename: str, content_type: str) -> Dict[str, Any]:
    """
    Process a TDS file with AI to extract information.
    
    Args:
        file_content: File content as bytes
        filename: Original filename
        content_type: MIME type of the file
    
    Returns:
        Dictionary with extracted TDS information
    """
    # Extract text from file
    text_content = extract_text_from_file(file_content, filename, content_type)
    
    if not text_content or text_content.startswith("[Error") or text_content.startswith("[File type"):
        raise ValueError(f"Could not extract text from file: {text_content}")
    
    # Extract information using AI
    extracted_info = extract_tds_info_with_ai(text_content)
    
    if not extracted_info:
        # Last resort: try to parse simple key: value lines
        guess = {}
        for line in text_content.splitlines():
            if ":" in line and len(line) < 200:
                parts = line.split(":", 1)
                if len(parts) == 2:
                    k = parts[0].strip().lower().replace(' ', '_')
                    v = parts[1].strip()
                    if k and v:
                        guess[k] = v
        if guess:
            extracted_info = guess
    
    if not extracted_info:
        raise ValueError("AI extraction failed. Please check your file.")
    
    # Normalize keys to match our expected format
    normalized = {}
    key_mapping = {
        "generic_product_name": ["generic_product_name", "generic product name", "product_name", "product name"],
        "trade_name": ["trade_name", "trade name", "model_name", "model name", "brand_name", "brand name"],
        "supplier_name": ["supplier_name", "supplier name", "manufacturer", "manufacturer_name"],
        "packaging_size_type": ["packaging_size_type", "packaging size & type", "packaging", "packaging_size"],
        "net_weight": ["net_weight", "net weight", "weight"],
        "hs_code": ["hs_code", "hs code", "hscode", "harmonized_system_code"],
        "technical_specification": ["technical_specification", "technical specification", "specification", "specs"]
    }
    
    for target_key, possible_keys in key_mapping.items():
        for possible_key in possible_keys:
            if possible_key in extracted_info:
                normalized[target_key] = extracted_info[possible_key]
                break

    description = generate_product_description_with_ai(text_content, normalized)
    if description:
        normalized["product_description"] = description
        normalized["ai_product_description"] = description

    return normalized


 # =============================
 # HELPER FUNCTIONS
 # =============================
 
 
def get_all_categories() -> List[str]:
    """
    Unique product categories from `chemical_full_data` (master PMS catalog).

    The legacy `chemical_types` table is not present in Supabase; categories
    live on chemical_full_data.product_category.
    """
    return get_all_product_categories_from_full_data()


# =============================
# PARTNER CHEMICALS
# =============================

_PARTNER_CHEMICAL_META_KEYS = (
    "product_category",
    "sub_category",
    "product_name",
    "brand",
    "packing",
    "price",
    "competitive_price",
    "cost",
    "tds_id",
)


def _parse_metadata(raw: Any) -> Dict[str, Any]:
    if raw is None:
        return {}
    if isinstance(raw, dict):
        return dict(raw)
    if isinstance(raw, str):
        try:
            parsed = json.loads(raw)
            return dict(parsed) if isinstance(parsed, dict) else {}
        except json.JSONDecodeError:
            return {}
    return {}


def _partner_chemical_row_to_api(row: Dict[str, Any]) -> Dict[str, Any]:
    """Map DB row (vendor/country/metadata) to API shape with legacy flat fields."""
    out = dict(row)
    meta = _parse_metadata(out.get("metadata"))
    for key in _PARTNER_CHEMICAL_META_KEYS:
        if out.get(key) is None and meta.get(key) is not None:
            out[key] = meta.get(key)
    return out


def _partner_chemical_insert_payload(body: PartnerChemicalCreate | PartnerChemicalUpdate) -> Dict[str, Any]:
    """Only columns that exist on partner_chemicals; extras go into metadata JSON."""
    data = body.model_dump(exclude_unset=True)
    meta = _parse_metadata(data.pop("metadata", None))
    for key in _PARTNER_CHEMICAL_META_KEYS:
        if key in data and data[key] is not None:
            meta[key] = data.pop(key)
    payload: Dict[str, Any] = {}
    if "vendor" in data:
        payload["vendor"] = data["vendor"]
    if "country" in data:
        payload["country"] = data["country"]
    if meta:
        payload["metadata"] = meta
    return payload


def find_or_create_partner(partner_name: str, partner_country: Optional[str] = None) -> Partner:
    """Resolve vendor name to a partner_data row (create if missing)."""
    name = (partner_name or "").strip()
    if not name:
        raise ValueError("Partner name is required")
    supabase: Client = get_supabase_client()
    existing = (
        supabase.table("partner_data")
        .select("*")
        .ilike("partner", name)
        .limit(20)
        .execute()
    )
    for row in existing.data or []:
        if (row.get("partner") or "").strip().lower() == name.lower():
            return Partner(**row)
    return create_partner(PartnerCreate(partner=name, partner_country=partner_country))


def list_partner_chemicals(
    limit: int = 100,
    offset: int = 0,
    vendor: Optional[str] = None,
    product_category: Optional[str] = None,
    sub_category: Optional[str] = None,
) -> List[PartnerChemical]:
    supabase: Client = get_supabase_client()
    query = supabase.table("partner_chemicals").select("*")

    if vendor:
        query = query.ilike("vendor", f"%{vendor}%")

    response = (
        query.order("created_at", desc=True)
        .limit(limit)
        .offset(offset)
        .execute()
    )
    rows = [_partner_chemical_row_to_api(dict(row)) for row in (response.data or [])]
    if product_category:
        needle = product_category.lower()
        rows = [
            r
            for r in rows
            if needle in ((r.get("product_category") or "")).lower()
        ]
    if sub_category:
        needle = sub_category.lower()
        rows = [
            r
            for r in rows
            if needle in ((r.get("sub_category") or "")).lower()
        ]
    return [PartnerChemical(**row) for row in rows]


def count_partner_chemicals() -> int:
    supabase: Client = get_supabase_client()
    response = supabase.table("partner_chemicals").select("id", count="exact").execute()
    return response.count or 0


def create_partner_chemical(body: PartnerChemicalCreate) -> PartnerChemical:
    supabase: Client = get_supabase_client()
    payload = _partner_chemical_insert_payload(body)
    if not payload.get("vendor"):
        raise ValueError("vendor is required")

    response = supabase.table("partner_chemicals").insert(payload).execute()
    if not response.data:
        raise RuntimeError("Failed to create partner chemical")
    return PartnerChemical(**_partner_chemical_row_to_api(response.data[0]))


def get_partner_chemical_by_id(partner_chemical_id: str) -> Optional[PartnerChemical]:
    supabase: Client = get_supabase_client()
    response = (
        supabase.table("partner_chemicals")
        .select("*")
        .eq("id", partner_chemical_id)
        .single()
        .execute()
    )
    if response.data:
        return PartnerChemical(**_partner_chemical_row_to_api(response.data))
    return None


def update_partner_chemical(partner_chemical_id: str, body: PartnerChemicalUpdate) -> PartnerChemical:
    supabase: Client = get_supabase_client()
    existing = get_partner_chemical_by_id(partner_chemical_id)
    if not existing:
        raise ValueError("Partner chemical not found")

    merged_meta = _parse_metadata(existing.metadata)
    incoming = _partner_chemical_insert_payload(body)
    if incoming.get("metadata"):
        merged_meta.update(incoming["metadata"])
    update_payload: Dict[str, Any] = {}
    if "vendor" in incoming:
        update_payload["vendor"] = incoming["vendor"]
    if "country" in incoming:
        update_payload["country"] = incoming["country"]
    if merged_meta:
        update_payload["metadata"] = merged_meta
    if not update_payload:
        return existing

    response = (
        supabase.table("partner_chemicals")
        .update(update_payload)
        .eq("id", partner_chemical_id)
        .execute()
    )
    if not response.data:
        raise RuntimeError("Failed to update partner chemical")
    return PartnerChemical(**_partner_chemical_row_to_api(response.data[0]))


def delete_partner_chemical(partner_chemical_id: str) -> bool:
    supabase: Client = get_supabase_client()
    response = (
        supabase.table("partner_chemicals")
        .delete()
        .eq("id", partner_chemical_id)
        .execute()
    )
    return True


def get_all_vendors() -> List[str]:
    """Fetch all unique vendors from partner_chemicals table."""
    supabase: Client = get_supabase_client()
    try:
        response = supabase.table("partner_chemicals").select("vendor").execute()
        vendors_set = set()
        for row in response.data or []:
            vendor = (row.get("vendor") or "").strip()
            if vendor:
                vendors_set.add(vendor)
        return sorted(list(vendors_set))
    except Exception:
        return []


def get_all_product_categories() -> List[str]:
    """Product categories from chemical_full_data (partner_chemicals has no category column)."""
    return get_all_product_categories_from_full_data()


def get_all_sub_categories() -> List[str]:
    """Sub-categories from chemical_full_data."""
    return get_all_sub_categories_from_full_data()


# =============================
# CHEMICAL FULL DATA
# =============================


def list_chemical_full_data(
    limit: int = 100,
    offset: int = 0,
    sector: Optional[str] = None,
    industry: Optional[str] = None,
    vendor: Optional[str] = None,
    product_category: Optional[str] = None,
    sub_category: Optional[str] = None,
    search: Optional[str] = None,
) -> List[ChemicalFullData]:
    """List Chemical_Master_Data (API shape: ChemicalFullData)."""
    from app.services.chemical_master_data import list_chemical_master_data

    return list_chemical_master_data(
        limit=limit,
        offset=offset,
        sector=sector,
        industry=industry,
        vendor=vendor,
        product_category=product_category,
        sub_category=sub_category,
        search=search,
    )


def count_chemical_full_data(
    sector: Optional[str] = None,
    industry: Optional[str] = None,
    vendor: Optional[str] = None,
    product_category: Optional[str] = None,
    sub_category: Optional[str] = None,
    search: Optional[str] = None,
) -> int:
    """Count Chemical_Master_Data rows."""
    from app.services.chemical_master_data import count_chemical_master_data

    return count_chemical_master_data(
        sector=sector,
        industry=industry,
        vendor=vendor,
        product_category=product_category,
        sub_category=sub_category,
        search=search,
    )


def create_chemical_full_data(body: ChemicalFullDataCreate) -> ChemicalFullData:
    """Create a Chemical_Master_Data record."""
    from app.services.chemical_master_data import create_chemical_master_data

    return create_chemical_master_data(body)


def get_chemical_full_data_by_id(chemical_id: int) -> Optional[ChemicalFullData]:
    """Get a single Chemical_Master_Data row by Row_No."""
    from app.services.chemical_master_data import get_chemical_master_data_by_id

    return get_chemical_master_data_by_id(chemical_id)


def update_chemical_full_data(chemical_id: int, body: ChemicalFullDataUpdate) -> ChemicalFullData:
    """Update a Chemical_Master_Data record."""
    from app.services.chemical_master_data import update_chemical_master_data

    return update_chemical_master_data(chemical_id, body)


def delete_chemical_full_data(chemical_id: int) -> bool:
    """Delete a Chemical_Master_Data record."""
    from app.services.chemical_master_data import delete_chemical_master_data

    return delete_chemical_master_data(chemical_id)


def get_all_sectors() -> List[str]:
    from app.services.chemical_master_data import get_all_sectors as _sectors

    return _sectors()


def get_all_industries() -> List[str]:
    from app.services.chemical_master_data import get_all_industries as _industries

    return _industries()


def get_all_product_names() -> List[str]:
    from app.services.chemical_master_data import get_all_product_names as _names

    return _names()


def get_all_product_categories_from_full_data() -> List[str]:
    from app.services.chemical_master_data import get_all_product_categories

    return get_all_product_categories()


def get_all_sub_categories_from_full_data() -> List[str]:
    from app.services.chemical_master_data import get_all_sub_categories

    return get_all_sub_categories()
 