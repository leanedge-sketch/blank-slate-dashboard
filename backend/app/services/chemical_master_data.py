"""
Chemical_Master_Data table adapter.

Maps Supabase table ``Chemical_Master_Data`` (PascalCase columns) to the
existing ``ChemicalFullData`` API shape (snake_case) used across PMS, Sales,
and the shared catalog.
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional
from uuid import UUID, uuid4

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

_EXTENDED_DB_COLUMNS = frozenset(
    {"Industry", "Price", "Typical_Application", "Product_Description", "Partner_ID"}
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
    "partner_id": "Partner_ID",
    "uuid_id": "uuid_id",
}

_DB_TO_API = {db: api for api, db in _API_TO_DB.items()}


def _master_client() -> Client:
    """Writes may require service role when RLS is enabled on Chemical_Master_Data."""
    try:
        return get_supabase_service_client()
    except RuntimeError:
        return get_supabase_client()


def _read_client() -> Client:
    """Chemical_Master_Data may be restricted by RLS for the anon key."""
    return _master_client()


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
    if not data.get("industry") and row.get("Product_Type"):
        data["industry"] = row["Product_Type"]
    if not data.get("typical_application") and row.get("Generic_Name"):
        data["typical_application"] = row["Generic_Name"]
    return ChemicalFullData(**data)


def api_to_db(payload: Dict[str, Any]) -> Dict[str, Any]:
    out: Dict[str, Any] = {}
    for api_col, db_col in _API_TO_DB.items():
        if api_col in payload and api_col != "id":
            out[db_col] = payload[api_col]
    return _convert_uuids(out)


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
    if industry:
        query = query.ilike("Industry", f"%{industry}%")
    if vendor:
        query = query.ilike("Supplier_Name", f"%{vendor}%")
    if product_category:
        query = query.ilike("Category", f"%{product_category}%")
    if sub_category:
        query = query.ilike("Sub_Category", f"%{sub_category}%")
    query = _apply_search_filter(query, search)

    response = (
        query.order("Row_No", desc=False).limit(limit).offset(offset).execute()
    )
    return [row_to_api(row) for row in (response.data or [])]


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
    if industry:
        query = query.ilike("Industry", f"%{industry}%")
    if vendor:
        query = query.ilike("Supplier_Name", f"%{vendor}%")
    if product_category:
        query = query.ilike("Category", f"%{product_category}%")
    if sub_category:
        query = query.ilike("Sub_Category", f"%{sub_category}%")
    query = _apply_search_filter(query, search)

    response = query.execute()
    return response.count or 0


def _insert_master_row(client: Client, payload: Dict[str, Any]):
    try:
        return client.table(TABLE).insert(payload).execute()
    except Exception as exc:
        msg = str(exc).lower()
        if "column" in msg and "does not exist" in msg:
            trimmed = {
                k: v
                for k, v in payload.items()
                if k not in _EXTENDED_DB_COLUMNS and k != "uuid_id"
            }
            return client.table(TABLE).insert(trimmed).execute()
        raise


def create_chemical_master_data(body: ChemicalFullDataCreate) -> ChemicalFullData:
    client = _master_client()
    payload = api_to_db(body.model_dump(exclude_unset=True))
    if "uuid_id" not in payload:
        payload["uuid_id"] = str(uuid4())
    if "Row_No" not in payload or payload.get("Row_No") is None:
        payload["Row_No"] = _next_row_no(client)

    response = _insert_master_row(client, payload)
    if not response.data:
        raise RuntimeError("Failed to create Chemical_Master_Data record")
    created = row_to_api(response.data[0])
    if created.id is not None:
        from app.services.catalog_sync_service import refresh_catalog_row

        refreshed = refresh_catalog_row(int(created.id))
        if refreshed:
            return refreshed
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
    payload = api_to_db(body.model_dump(exclude_unset=True))
    response = (
        client.table(TABLE).update(payload).eq("Row_No", chemical_id).execute()
    )
    if not response.data:
        raise RuntimeError(f"Failed to update Chemical_Master_Data Row_No={chemical_id}")

    from app.services.catalog_sync_service import refresh_catalog_row

    refreshed = refresh_catalog_row(chemical_id)
    return refreshed or row_to_api(response.data[0])


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
    client = _read_client()
    industries = _distinct_column(client, "Industry")
    if industries:
        return industries
    return _distinct_column(client, "Product_Type")


def get_all_product_categories() -> List[str]:
    return _distinct_column(_read_client(), "Category")


def get_all_sub_categories() -> List[str]:
    return _distinct_column(_read_client(), "Sub_Category")


def get_all_product_names() -> List[str]:
    return _distinct_column(_read_client(), "Product_Name")
