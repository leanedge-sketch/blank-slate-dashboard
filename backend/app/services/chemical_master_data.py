"""
Chemical_Master_Data table adapter.

Maps Supabase table ``Chemical_Master_Data`` (PascalCase columns) to the
existing ``ChemicalFullData`` API shape (snake_case) used across PMS, Sales,
and the shared catalog.
"""

from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional
from uuid import UUID, uuid4

logger = logging.getLogger(__name__)

from supabase import Client

from app.database.connection import get_supabase_client, get_supabase_service_client
from app.models.pms import ChemicalFullData, ChemicalFullDataCreate, ChemicalFullDataUpdate

TABLE = "Chemical_Master_Data"

PMS_SECTOR_OPTIONS = [
    "Construction",
    "Paint and Coating",
    "Personal and Cleaning",
    "Plastic and Foam",
    "Food and Pharmaceutical",
]

PMS_INDUSTRY_OPTIONS = [
    "Dry Mix mortar",
    "Concrete admixture",
    "Paint and Coating",
    "Plastic",
    "Foam",
    "Detergent",
    "Food",
    "Pharmaceutical",
]

# Columns present on the live Chemical_Master_Data table (before optional migration).
_BASE_DB_COLUMNS = frozenset(
    {
        "Row_No",
        "Supplier_Name",
        "Category",
        "Sub_Category",
        "Product_Name",
        "Packaging",
        "HS_Code",
        "Generic_Name",
        "Product_Type",
        "Country_of_Origin",
        "Sector",
    }
)

# Added by docs/0005_chemical_master_data_extend.sql when that migration is applied.
_OPTIONAL_DB_COLUMNS = frozenset(
    {
        "Industry",
        "Price",
        "Typical_Application",
        "Product_Description",
        "Partner_ID",
        "uuid_id",
        "Current_Price",
        "Current_Price_Currency",
        "Current_Cost",
        "Current_Cost_Currency",
        "current_price",
        "current_price_currency",
        "current_cost",
        "current_cost_currency",
    }
)

# API field -> DB column
_API_TO_DB = {
    "id": "Row_No",
    "product_name": "Product_Name",
    "vendor": "Supplier_Name",
    "product_category": "Category",
    "sub_category": "Sub_Category",
    "sector": "Sector",
    "packing": "Packaging",
    "hs_code": "HS_Code",
    "generic_name": "Generic_Name",
    "product_type": "Product_Type",
    "country_of_origin": "Country_of_Origin",
    "industry": "Industry",
    "typical_application": "Typical_Application",
    "product_description": "Product_Description",
    "price": "Price",
    "current_price": "Current_Price",
    "current_price_currency": "Current_Price_Currency",
    "current_cost": "Current_Cost",
    "current_cost_currency": "Current_Cost_Currency",
    "partner_id": "Partner_ID",
    "uuid_id": "uuid_id",
}

_DB_TO_API = {db: api for api, db in _API_TO_DB.items()}

_LIVE_OPTIONAL_COLUMNS: Optional[frozenset[str]] = None


def _probe_live_optional_columns(client: Client) -> frozenset[str]:
    """Detect which docs/0005 optional columns exist (cached per process)."""
    global _LIVE_OPTIONAL_COLUMNS
    if _LIVE_OPTIONAL_COLUMNS is not None:
        return _LIVE_OPTIONAL_COLUMNS
    present: set[str] = set()
    for col in _OPTIONAL_DB_COLUMNS:
        try:
            client.table(TABLE).select(col).limit(1).execute()
            present.add(col)
        except Exception:
            continue
    _LIVE_OPTIONAL_COLUMNS = frozenset(present)
    if not present:
        logger.info(
            "Chemical_Master_Data optional columns not migrated — run docs/0005_chemical_master_data_extend.sql"
        )
    return _LIVE_OPTIONAL_COLUMNS


def _master_client() -> Client:
    """Writes may require service role when RLS is enabled on Chemical_Master_Data."""
    try:
        return get_supabase_service_client()
    except RuntimeError:
        return get_supabase_client()


def _read_client() -> Client:
    """Chemical_Master_Data may be restricted by RLS for the anon key."""
    try:
        return get_supabase_service_client()
    except RuntimeError as exc:
        logger.warning("SUPABASE_SERVICE_KEY unavailable for Chemical_Master_Data: %s", exc)
        return get_supabase_client()


def _postgrest_ilike_pattern(term: str) -> str:
    """
    PostgREST ilike values with spaces or punctuation must be double-quoted.
    Unquoted patterns like %Dry Mix% break multi-word search.
    """
    cleaned = term.strip().replace(",", " ")
    if not cleaned:
        return ""
    escaped = cleaned.replace("\\", "\\\\").replace('"', '""')
    return f'"%{escaped}%"'


def _apply_industry_filter(query, industry: Optional[str], client: Client):
    if not industry or not industry.strip():
        return query
    pattern = _postgrest_ilike_pattern(industry)
    if not pattern:
        return query
    optional = _probe_live_optional_columns(client)
    if "Industry" in optional:
        return query.or_(f"Industry.ilike.{pattern},Product_Type.ilike.{pattern}")
    return query.ilike("Product_Type", pattern.strip())


def _convert_uuids(value: Any) -> Any:
    if isinstance(value, UUID):
        return str(value)
    if isinstance(value, dict):
        return {k: _convert_uuids(v) for k, v in value.items()}
    if isinstance(value, list):
        return [_convert_uuids(v) for v in value]
    return value


def row_to_api(row: Dict[str, Any]) -> ChemicalFullData:
    data: Dict[str, Any] = {}
    for db_col, api_col in _DB_TO_API.items():
        if db_col in row:
            data[api_col] = row[db_col]
    if data.get("id") is None and row.get("Row_No") is not None:
        data["id"] = row["Row_No"]
    if not data.get("industry"):
        if row.get("Industry"):
            data["industry"] = row["Industry"]
        elif row.get("Product_Type"):
            data["industry"] = row["Product_Type"]
    # Support PascalCase or lowercase pricing snapshot columns.
    for pascal, snake, api_key in (
        ("Current_Price", "current_price", "current_price"),
        ("Current_Price_Currency", "current_price_currency", "current_price_currency"),
        ("Current_Cost", "current_cost", "current_cost"),
        ("Current_Cost_Currency", "current_cost_currency", "current_cost_currency"),
    ):
        if data.get(api_key) is None:
            if row.get(pascal) is not None:
                data[api_key] = row[pascal]
            elif row.get(snake) is not None:
                data[api_key] = row[snake]
    return ChemicalFullData(**data)


def _prepare_write_payload(
    payload: Dict[str, Any],
    *,
    assign_uuid_if_missing: bool = False,
) -> Dict[str, Any]:
    """Map API fields to DB columns that exist on Chemical_Master_Data."""
    raw: Dict[str, Any] = {}
    for api_col, db_col in _API_TO_DB.items():
        if api_col in payload and api_col != "id":
            raw[db_col] = payload[api_col]

    optional_live = _probe_live_optional_columns(_read_client())
    allowed = _BASE_DB_COLUMNS | optional_live
    industry_val = raw.get("Industry")
    if industry_val and "Industry" not in optional_live and not raw.get("Product_Type"):
        raw["Product_Type"] = industry_val
        raw.pop("Industry", None)
    trimmed = {k: v for k, v in raw.items() if k in allowed and v is not None}
    if (
        assign_uuid_if_missing
        and "uuid_id" in optional_live
        and trimmed.get("uuid_id") is None
    ):
        trimmed["uuid_id"] = str(uuid4())
    return _convert_uuids(trimmed)


def api_to_db(payload: Dict[str, Any], *, assign_uuid_if_missing: bool = False) -> Dict[str, Any]:
    return _prepare_write_payload(payload, assign_uuid_if_missing=assign_uuid_if_missing)


def _next_row_no(client: Client) -> int:
    resp = (
        client.table(TABLE)
        .select("Row_No")
        .order("Row_No", desc=True)
        .limit(1)
        .execute()
    )
    if resp.data:
        current = resp.data[0].get("Row_No")
        if current is not None:
            return int(current) + 1
    return 1


def _apply_search_filter(query, search: Optional[str], client: Optional[Client] = None):
    if not search or not search.strip():
        return query
    pattern = _postgrest_ilike_pattern(search)
    if not pattern:
        return query
    columns = [
        "Product_Name",
        "Generic_Name",
        "Supplier_Name",
        "HS_Code",
    ]
    parts = [f"{col}.ilike.{pattern}" for col in columns]
    return query.or_(",".join(parts))


def list_chemical_master_data(
    limit: int = 100,
    offset: int = 0,
    sector: Optional[str] = None,
    industry: Optional[str] = None,
    vendor: Optional[str] = None,
    product_category: Optional[str] = None,
    sub_category: Optional[str] = None,
    search: Optional[str] = None,
) -> List[ChemicalFullData]:
    client = _read_client()
    query = client.table(TABLE).select("*")

    if sector:
        query = query.ilike("Sector", f"%{sector}%")
    query = _apply_industry_filter(query, industry, client)
    if vendor:
        query = query.ilike("Supplier_Name", f"%{vendor}%")
    if product_category:
        query = query.ilike("Category", f"%{product_category}%")
    if sub_category:
        query = query.ilike("Sub_Category", f"%{sub_category}%")
    query = _apply_search_filter(query, search, client)

    response = (
        query.order("Supplier_Name", desc=False)
        .order("Product_Name", desc=False)
        .order("Row_No", desc=False)
        .limit(limit)
        .offset(offset)
        .execute()
    )
    rows = response.data or []
    if not rows and offset == 0 and not any(
        [sector, industry, vendor, product_category, sub_category, search]
    ):
        probe = client.table(TABLE).select("Row_No", count="exact").limit(1).execute()
        if (probe.count or 0) > 0:
            raise RuntimeError(
                "Chemical_Master_Data is not readable — set SUPABASE_SERVICE_KEY on the server "
                "or run docs/0005b_chemical_master_data_grants.sql in Supabase."
            )
    return [row_to_api(row) for row in rows]


def count_chemical_master_data(
    sector: Optional[str] = None,
    industry: Optional[str] = None,
    vendor: Optional[str] = None,
    product_category: Optional[str] = None,
    sub_category: Optional[str] = None,
    search: Optional[str] = None,
) -> int:
    client = _read_client()
    query = client.table(TABLE).select("Row_No", count="exact")

    if sector:
        query = query.ilike("Sector", f"%{sector}%")
    query = _apply_industry_filter(query, industry, client)
    if vendor:
        query = query.ilike("Supplier_Name", f"%{vendor}%")
    if product_category:
        query = query.ilike("Category", f"%{product_category}%")
    if sub_category:
        query = query.ilike("Sub_Category", f"%{sub_category}%")
    query = _apply_search_filter(query, search, client)

    response = query.execute()
    return response.count or 0


def _is_missing_column_error(exc: Exception) -> bool:
    msg = str(exc).lower()
    return (
        "does not exist" in msg
        or "schema cache" in msg
        or "pgrst204" in msg
        or "could not find" in msg
    )


def _insert_master_row(client: Client, payload: Dict[str, Any]):
    """Insert one master row — single attempt using columns known to exist (no retry insert)."""
    optional_live = _probe_live_optional_columns(client)
    base_payload = {k: v for k, v in payload.items() if k in _BASE_DB_COLUMNS}
    optional_payload = {
        k: v
        for k, v in payload.items()
        if k in _OPTIONAL_DB_COLUMNS and k in optional_live
    }
    merged = {**base_payload, **optional_payload}
    if not merged:
        raise RuntimeError("Nothing to insert for Chemical_Master_Data")
    return client.table(TABLE).insert(merged).execute()


def _update_master_row(client: Client, chemical_id: int, payload: Dict[str, Any]):
    if not payload:
        return None
    base_payload = {k: v for k, v in payload.items() if k in _BASE_DB_COLUMNS}
    optional_payload = {
        k: v for k, v in payload.items() if k in _OPTIONAL_DB_COLUMNS
    }
    merged = {**base_payload, **optional_payload}
    if not merged:
        return None
    try:
        return (
            client.table(TABLE).update(merged).eq("Row_No", chemical_id).execute()
        )
    except Exception as exc:
        if _is_missing_column_error(exc):
            optional = {
                k: v
                for k, v in payload.items()
                if k in _OPTIONAL_DB_COLUMNS and v is not None
            }
            retry_merged = {**base_payload, **optional}
            if not retry_merged:
                return None
            try:
                return (
                    client.table(TABLE)
                    .update(retry_merged)
                    .eq("Row_No", chemical_id)
                    .execute()
                )
            except Exception as retry_exc:
                if _is_missing_column_error(retry_exc) and base_payload:
                    return (
                        client.table(TABLE)
                        .update(base_payload)
                        .eq("Row_No", chemical_id)
                        .execute()
                    )
                raise
        raise


def create_chemical_master_data(body: ChemicalFullDataCreate) -> ChemicalFullData:
    client = _master_client()
    payload = api_to_db(body.model_dump(exclude_unset=True), assign_uuid_if_missing=True)
    if "Row_No" not in payload or payload.get("Row_No") is None:
        payload["Row_No"] = _next_row_no(client)

    # Avoid duplicate rows when the same product+supplier is submitted twice quickly.
    product_name = (payload.get("Product_Name") or "").strip()
    supplier = (payload.get("Supplier_Name") or "").strip()
    category = (payload.get("Category") or "").strip()
    packing = (payload.get("Packaging") or "").strip()
    if product_name and supplier:
        probe = (
            client.table(TABLE)
            .select("Row_No, Product_Name, Category, Packaging")
            .ilike("Product_Name", product_name)
            .ilike("Supplier_Name", supplier)
            .order("Row_No", desc=True)
            .limit(5)
            .execute()
        )
        for row in probe.data or []:
            if (
                (row.get("Product_Name") or "").strip().lower() == product_name.lower()
                and (row.get("Category") or "").strip().lower() == category.lower()
                and (row.get("Packaging") or "").strip().lower() == packing.lower()
            ):
                existing_id = row.get("Row_No")
                if existing_id is not None:
                    existing = get_chemical_master_data_by_id(int(existing_id))
                    if existing:
                        logger.info(
                            "Reusing existing Chemical_Master_Data Row_No=%s (duplicate create)",
                            existing_id,
                        )
                        from app.services.catalog_sync_service import (
                            enrich_chemical_with_tds_document,
                        )

                        return enrich_chemical_with_tds_document(existing)

    response = _insert_master_row(client, payload)
    if not response.data:
        raise RuntimeError("Failed to create Chemical_Master_Data record")
    created = row_to_api(response.data[0])
    if created.id is not None:
        from app.services.catalog_sync_service import refresh_catalog_row

        try:
            refreshed = refresh_catalog_row(int(created.id))
            if refreshed:
                return refreshed
        except Exception as exc:
            logger.warning(
                "Catalog sync after create failed for Row_No=%s: %s",
                created.id,
                exc,
            )
    return created


def get_chemical_master_data_by_id(chemical_id: int) -> Optional[ChemicalFullData]:
    client = _read_client()
    response = (
        client.table(TABLE).select("*").eq("Row_No", chemical_id).limit(1).execute()
    )
    if response.data:
        return row_to_api(response.data[0])
    return None


def get_chemical_master_data_by_uuid(uuid_value: str) -> Optional[ChemicalFullData]:
    client = _read_client()
    response = (
        client.table(TABLE)
        .select("*")
        .eq("uuid_id", uuid_value)
        .limit(1)
        .execute()
    )
    if response.data:
        return row_to_api(response.data[0])
    return None


def update_chemical_master_data(
    chemical_id: int, body: ChemicalFullDataUpdate
) -> ChemicalFullData:
    client = _master_client()
    # Never rewrite uuid_id on edit — avoids duplicate-key errors; ensure runs after.
    payload = api_to_db(body.model_dump(exclude_unset=True), assign_uuid_if_missing=False)
    payload.pop("uuid_id", None)
    response = _update_master_row(client, chemical_id, payload)
    if not response or not response.data:
        raise RuntimeError(f"Failed to update Chemical_Master_Data Row_No={chemical_id}")

    from app.services.catalog_sync_service import refresh_catalog_row

    refreshed = refresh_catalog_row(chemical_id)
    return refreshed or row_to_api(response.data[0])


def sync_pricing_snapshot_to_catalog(
    chemical_id: int,
    *,
    price_amount: float,
    price_currency: str,
    cost_amount: float,
    cost_currency: str,
) -> None:
    """Write latest Pricing & Costing sell/cost snapshot onto Chemical_Master_Data."""
    optional = _probe_live_optional_columns(_read_client())
    payload: Dict[str, Any] = {}
    if "Price" in optional:
        payload["price"] = price_amount
    if "Current_Price" in optional:
        payload["current_price"] = price_amount
    if "Current_Price_Currency" in optional:
        payload["current_price_currency"] = price_currency
    if "Current_Cost" in optional:
        payload["current_cost"] = cost_amount
    if "Current_Cost_Currency" in optional:
        payload["current_cost_currency"] = cost_currency
    if not payload:
        return
    client = _master_client()
    db_payload: Dict[str, Any] = {}
    for api_key, db_pascal in (
        ("current_price", "Current_Price"),
        ("current_price_currency", "Current_Price_Currency"),
        ("current_cost", "Current_Cost"),
        ("current_cost_currency", "Current_Cost_Currency"),
        ("price", "Price"),
    ):
        if api_key not in payload:
            continue
        snake = api_key
        if db_pascal in optional:
            db_payload[db_pascal] = payload[api_key]
        elif snake in optional:
            db_payload[snake] = payload[api_key]
    if not db_payload:
        return
    _update_master_row(client, chemical_id, _convert_uuids(db_payload))
    try:
        from app.services.catalog_sync_service import refresh_catalog_row

        refresh_catalog_row(chemical_id)
    except Exception as exc:
        logger.debug("Catalog refresh after pricing sync skipped: %s", exc)


def delete_chemical_master_data(chemical_id: int) -> bool:
    client = _master_client()
    client.table(TABLE).delete().eq("Row_No", chemical_id).execute()
    return True


def _distinct_column(client: Client, column: str) -> List[str]:
    try:
        response = client.table(TABLE).select(column).execute()
    except Exception:
        return []
    values = set()
    for row in response.data or []:
        val = (row.get(column) or "").strip()
        if val:
            values.add(val)
    return sorted(values)


def get_all_sectors() -> List[str]:
    return list(PMS_SECTOR_OPTIONS)


def get_all_industries() -> List[str]:
    return list(PMS_INDUSTRY_OPTIONS)


def get_all_product_categories() -> List[str]:
    return _distinct_column(_read_client(), "Category")


def get_all_sub_categories() -> List[str]:
    return _distinct_column(_read_client(), "Sub_Category")


def get_all_product_names() -> List[str]:
    return _distinct_column(_read_client(), "Product_Name")


def get_all_suppliers() -> List[str]:
    return _distinct_column(_read_client(), "Supplier_Name")
