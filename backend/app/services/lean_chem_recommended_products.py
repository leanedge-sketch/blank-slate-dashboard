"""
LeanChem_Recommended_Products — curated product recommendations.

Schema mirrors Chemical_Master_Data base columns plus optional link back to
master data when a row was pulled from a suggestion.
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from supabase import Client

from app.database.connection import get_supabase_client, get_supabase_service_client
from app.models.pms import (
    LeanChemRecommendedProduct,
    LeanChemRecommendedProductCreate,
    LeanChemRecommendedProductUpdate,
)
from app.services.chemical_master_data import PMS_INDUSTRY_OPTIONS, PMS_SECTOR_OPTIONS

logger = logging.getLogger(__name__)

TABLE = "LeanChem_Recommended_Products"

_DB_COLUMNS = frozenset(
    {
        "Row_No",
        "Sector",
        "Industry",
        "Supplier_Name",
        "Category",
        "Sub_Category",
        "Product_Name",
        "Generic_Name",
        "Product_Type",
        "Packaging",
        "HS_Code",
        "Country_of_Origin",
        "source_master_row_no",
        "recommendation_notes",
        "created_at",
        "updated_at",
    }
)

_API_TO_DB = {
    "id": "Row_No",
    "sector": "Sector",
    "vendor": "Supplier_Name",
    "product_category": "Category",
    "sub_category": "Sub_Category",
    "product_name": "Product_Name",
    "generic_name": "Generic_Name",
    "product_type": "Product_Type",
    "packing": "Packaging",
    "hs_code": "HS_Code",
    "country_of_origin": "Country_of_Origin",
    "industry": "Industry",
    "source_master_row_no": "source_master_row_no",
    "recommendation_notes": "recommendation_notes",
}

_DB_TO_API = {db: api for api, db in _API_TO_DB.items()}
_DB_TO_API["Row_No"] = "id"


def _client() -> Client:
    try:
        return get_supabase_service_client()
    except RuntimeError:
        return get_supabase_client()


def row_to_api(row: Dict[str, Any]) -> LeanChemRecommendedProduct:
    data: Dict[str, Any] = {}
    for db_col, api_col in _DB_TO_API.items():
        if db_col in row:
            data[api_col] = row[db_col]
    if data.get("id") is None and row.get("Row_No") is not None:
        data["id"] = row["Row_No"]
    if not data.get("industry"):
        if row.get("Industry"):
            data["industry"] = row["Industry"]
        elif row.get("Product_Type") in PMS_INDUSTRY_OPTIONS:
            data["industry"] = row["Product_Type"]
    return LeanChemRecommendedProduct(**data)


def _is_missing_column_error(exc: Exception) -> bool:
    msg = str(exc).lower()
    return (
        "does not exist" in msg
        or "schema cache" in msg
        or "pgrst204" in msg
        or "could not find" in msg
    )


def _prepare_write_payload(payload: Dict[str, Any]) -> Dict[str, Any]:
    raw: Dict[str, Any] = {}
    for api_col, db_col in _API_TO_DB.items():
        if api_col in payload and api_col != "id":
            if db_col in _DB_COLUMNS:
                raw[db_col] = payload[api_col]

    now = datetime.now(timezone.utc).isoformat()
    raw["updated_at"] = now
    return {k: v for k, v in raw.items() if v is not None}


def _payload_without_industry_column(payload: Dict[str, Any]) -> Dict[str, Any]:
    """Drop Industry when the column is not migrated yet; preserve value when possible."""
    fallback = {k: v for k, v in payload.items() if k != "Industry"}
    industry = payload.get("Industry")
    product_type = fallback.get("Product_Type")
    if industry and not product_type:
        fallback["Product_Type"] = industry
    return fallback


def _insert_row(client: Client, payload: Dict[str, Any]):
    try:
        return client.table(TABLE).insert(payload).execute()
    except Exception as exc:
        if _is_missing_column_error(exc) and "Industry" in payload:
            return client.table(TABLE).insert(_payload_without_industry_column(payload)).execute()
        raise


def _update_row(client: Client, product_id: int, payload: Dict[str, Any]):
    try:
        return (
            client.table(TABLE).update(payload).eq("Row_No", product_id).execute()
        )
    except Exception as exc:
        if _is_missing_column_error(exc) and "Industry" in payload:
            return (
                client.table(TABLE)
                .update(_payload_without_industry_column(payload))
                .eq("Row_No", product_id)
                .execute()
            )
        raise


def _apply_search_filter(query, search: Optional[str]):
    if not search or not search.strip():
        return query
    term = search.strip().replace(",", " ")
    pattern = f"%{term}%"
    return query.or_(
        f"Product_Name.ilike.{pattern},"
        f"Generic_Name.ilike.{pattern},"
        f"Product_Type.ilike.{pattern},"
        f"HS_Code.ilike.{pattern}"
    )


def list_lean_chem_recommended_products(
    limit: int = 100,
    offset: int = 0,
    sector: Optional[str] = None,
    vendor: Optional[str] = None,
    product_category: Optional[str] = None,
    search: Optional[str] = None,
) -> List[LeanChemRecommendedProduct]:
    client = _client()
    query = client.table(TABLE).select("*")
    if sector:
        query = query.ilike("Sector", f"%{sector}%")
    if vendor:
        query = query.ilike("Supplier_Name", f"%{vendor}%")
    if product_category:
        query = query.ilike("Category", f"%{product_category}%")
    query = _apply_search_filter(query, search)
    response = (
        query.order("Supplier_Name", desc=False)
        .order("Product_Name", desc=False)
        .order("Row_No", desc=False)
        .limit(limit)
        .offset(offset)
        .execute()
    )
    return [row_to_api(row) for row in (response.data or [])]


def count_lean_chem_recommended_products(
    sector: Optional[str] = None,
    vendor: Optional[str] = None,
    product_category: Optional[str] = None,
    search: Optional[str] = None,
) -> int:
    client = _client()
    query = client.table(TABLE).select("Row_No", count="exact")
    if sector:
        query = query.ilike("Sector", f"%{sector}%")
    if vendor:
        query = query.ilike("Supplier_Name", f"%{vendor}%")
    if product_category:
        query = query.ilike("Category", f"%{product_category}%")
    query = _apply_search_filter(query, search)
    response = query.execute()
    return response.count or 0


def get_lean_chem_recommended_product_by_id(
    product_id: int,
) -> Optional[LeanChemRecommendedProduct]:
    client = _client()
    response = (
        client.table(TABLE).select("*").eq("Row_No", product_id).limit(1).execute()
    )
    if response.data:
        return row_to_api(response.data[0])
    return None


def create_lean_chem_recommended_product(
    body: LeanChemRecommendedProductCreate,
) -> LeanChemRecommendedProduct:
    client = _client()
    payload = _prepare_write_payload(body.model_dump(exclude_unset=True))
    payload.setdefault("created_at", datetime.now(timezone.utc).isoformat())
    response = _insert_row(client, payload)
    if not response.data:
        raise RuntimeError("Failed to create LeanChem recommended product")
    return row_to_api(response.data[0])


def update_lean_chem_recommended_product(
    product_id: int, body: LeanChemRecommendedProductUpdate
) -> LeanChemRecommendedProduct:
    client = _client()
    payload = _prepare_write_payload(body.model_dump(exclude_unset=True))
    if not payload:
        existing = get_lean_chem_recommended_product_by_id(product_id)
        if not existing:
            raise ValueError("Product not found")
        return existing
    response = _update_row(client, product_id, payload)
    if not response.data:
        raise RuntimeError(f"Failed to update LeanChem recommended product {product_id}")
    return row_to_api(response.data[0])


def delete_lean_chem_recommended_product(product_id: int) -> bool:
    client = _client()
    client.table(TABLE).delete().eq("Row_No", product_id).execute()
    return True


def suggest_from_chemical_master_data(
    search: str, limit: int = 10
) -> List[Dict[str, Any]]:
    """Return Chemical_Master_Data rows similar to the typed query."""
    from app.services.chemical_master_data import list_chemical_master_data

    term = (search or "").strip()
    if len(term) < 2:
        return []

    matches = list_chemical_master_data(search=term, limit=limit)
    suggestions: List[Dict[str, Any]] = []
    for chem in matches:
        suggestions.append(
            {
                "master_row_no": chem.id,
                "product_name": chem.product_name,
                "generic_name": chem.generic_name,
                "product_type": chem.product_type,
                "industry": chem.industry,
                "sector": chem.sector,
                "vendor": chem.vendor,
                "product_category": chem.product_category,
                "sub_category": chem.sub_category,
                "packing": chem.packing,
                "hs_code": chem.hs_code,
                "country_of_origin": chem.country_of_origin,
                "match_label": " · ".join(
                    x
                    for x in [
                        chem.product_name,
                        chem.generic_name,
                        chem.vendor,
                        chem.sector,
                    ]
                    if x
                ),
            }
        )
    return suggestions


def get_sector_options() -> List[str]:
    return list(PMS_SECTOR_OPTIONS)
