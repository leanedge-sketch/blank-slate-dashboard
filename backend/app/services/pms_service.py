"""
PMS Service - Business Logic Layer
==================================

This file contains the "business logic" for Product Management System (PMS)
operations on top of Supabase:
- chemical_types
- tds_data
- partner_data
- leanchem_products
- costing_pricing_data
"""

from typing import List, Optional, Dict, Any
import json
import re

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
    supabase: Client = get_supabase_client()
    try:
        response = (
            supabase.table("chemical_full_data")
            .select(
                "id, vendor, product_category, sub_category, product_name, "
                "packing, typical_application, product_description, hs_code, price"
            )
            .order("product_name", desc=False)
            .limit(limit)
            .offset(offset)
            .execute()
        )

        if response.data is None:
            return []

        adapted_rows: List[Dict[str, Any]] = []
        for row in response.data:
            row_dict = dict(row)
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
    supabase: Client = get_supabase_client()
    response = (
        supabase.table("chemical_full_data")
        .select("id", count="exact")
        .execute()
    )
    return response.count or 0


def create_chemical_type(body: ChemicalTypeCreate) -> ChemicalType:
    """
    Create a new record in `chemical_full_data` corresponding to a ChemicalType.

    We map the high-level fields:
      name      → product_name
      category  → product_category
      hs_code   → hs_code

    Other fields (applications/spec_template/metadata) are currently ignored.
    """
    supabase: Client = get_supabase_client()
    payload = body.model_dump(exclude_unset=True)

    insert_data: Dict[str, Any] = {
        "product_name": payload.get("name"),
        "product_category": payload.get("category"),
        "hs_code": payload.get("hs_code"),
    }

    response = supabase.table("chemical_full_data").insert(insert_data).execute()
    if not response.data:
        raise RuntimeError("Failed to create chemical type (chemical_full_data)")

    created = dict(response.data[0])
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
        },
        "created_at": None,
    }
    return ChemicalType(**adapted)


def get_chemical_type_by_id(chemical_id: str) -> Optional[ChemicalType]:
    supabase: Client = get_supabase_client()
    response = (
        supabase.table("chemical_full_data")
        .select(
            "id, vendor, product_category, sub_category, product_name, "
            "packing, typical_application, product_description, hs_code, price"
        )
        .eq("id", int(chemical_id))
        .single()
        .execute()
    )
    if response.data:
        row = dict(response.data)
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
    return None


def update_chemical_type(chemical_id: str, body: ChemicalTypeUpdate) -> ChemicalType:
    supabase: Client = get_supabase_client()
    existing = get_chemical_type_by_id(chemical_id)
    if not existing:
        raise ValueError("Chemical type not found")
    
    update_data = body.model_dump(exclude_unset=True)
    if not update_data:
        return existing
    
    # Map updatable fields
    mapped_update: Dict[str, Any] = {}
    if "name" in update_data:
        mapped_update["product_name"] = update_data["name"]
    if "category" in update_data:
        mapped_update["product_category"] = update_data["category"]
    if "hs_code" in update_data:
        mapped_update["hs_code"] = update_data["hs_code"]

    if not mapped_update:
        return existing

    response = (
        supabase.table("chemical_full_data")
        .update(mapped_update)
        .eq("id", int(chemical_id))
        .execute()
    )
    if not response.data:
        raise RuntimeError("Failed to update chemical type (chemical_full_data)")

    row = dict(response.data[0])
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
    supabase: Client = get_supabase_client()
    response = (
        supabase.table("chemical_full_data")
        .delete()
        .eq("id", int(chemical_id))
        .execute()
    )
    return True


# =============================
# TDS DATA
# =============================


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
    # NOTE:
    # The original schema used a `chemical_type_id` UUID column on `tds_data`.
    # After migrating to `chemical_full_data`, this column is no longer
    # reliable and may not exist in the current database, which was causing
    # 500 errors when filtering by `chemical_type_id`.
    # For now we ignore this filter to keep the endpoint stable. Later we can
    # re-introduce a proper link (e.g. chemical_full_id) if needed.

    response = (
        query.order("created_at", desc=True)
        .limit(limit)
        .offset(offset)
        .execute()
    )
    return [Tds(**row) for row in (response.data or [])]


def count_tds() -> int:
    supabase: Client = get_supabase_client()
    response = supabase.table("tds_data").select("id", count="exact").execute()
    return response.count or 0


def create_tds(body: TdsCreate) -> Tds:
    supabase: Client = get_supabase_client()
    payload = body.model_dump(exclude_unset=True)
    
    # Convert ALL UUIDs in the entire payload to strings (Supabase needs strings)
    from uuid import UUID
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
    return Tds(**response.data[0])


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
        return Tds(**response.data)
    return None


def update_tds(tds_id: str, body: TdsUpdate) -> Tds:
    supabase: Client = get_supabase_client()
    existing = get_tds_by_id(tds_id)
    if not existing:
        raise ValueError("TDS record not found")
    
    update_data = body.model_dump(exclude_unset=True)
    if not update_data:
        return existing
    
    # Convert ALL UUIDs in the update data to strings
    from uuid import UUID
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
    return Tds(**response.data[0])


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
    payload = body.model_dump(exclude_unset=True)
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
    
    return normalized


 # =============================
 # HELPER FUNCTIONS
 # =============================
 
 
def get_all_categories() -> List[str]:
     """
     Fetch all unique, non-empty categories from the `chemical_types` table.
 
     This is used by the CRM module when building AI customer profiles so that
     the Strategic-Fit Matrix is always aligned with the actual product
     taxonomy defined in PMS, instead of hard-coding category names.
     """
     supabase: Client = get_supabase_client()
     try:
         response = supabase.table("chemical_types").select("category").execute()
         categories_set = set()
         for row in response.data or []:
             cat = (row.get("category") or "").strip()
             if cat:
                 categories_set.add(cat)
         return sorted(list(categories_set))
     except Exception:
         # Safe fallback to the original default categories used in the MVP
         return ["Cement", "Dry-Mix", "Admixtures", "Paint & Coatings"]


# =============================
# PARTNER CHEMICALS
# =============================


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
    if product_category:
        query = query.ilike("product_category", f"%{product_category}%")
    if sub_category:
        query = query.ilike("sub_category", f"%{sub_category}%")

    response = (
        query.order("created_at", desc=True)
        .limit(limit)
        .offset(offset)
        .execute()
    )
    return [PartnerChemical(**row) for row in (response.data or [])]


def count_partner_chemicals() -> int:
    supabase: Client = get_supabase_client()
    response = supabase.table("partner_chemicals").select("id", count="exact").execute()
    return response.count or 0


def create_partner_chemical(body: PartnerChemicalCreate) -> PartnerChemical:
    supabase: Client = get_supabase_client()
    payload = body.model_dump(exclude_unset=True)
    
    # Convert UUIDs to strings
    from uuid import UUID
    def convert_uuids(obj):
        if isinstance(obj, UUID):
            return str(obj)
        elif isinstance(obj, dict):
            return {k: convert_uuids(v) for k, v in obj.items()}
        elif isinstance(obj, list):
            return [convert_uuids(item) for item in obj]
        return obj
    
    payload = convert_uuids(payload)
    
    response = supabase.table("partner_chemicals").insert(payload).execute()
    if not response.data:
        raise RuntimeError("Failed to create partner chemical")
    return PartnerChemical(**response.data[0])


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
        return PartnerChemical(**response.data)
    return None


def update_partner_chemical(partner_chemical_id: str, body: PartnerChemicalUpdate) -> PartnerChemical:
    supabase: Client = get_supabase_client()
    existing = get_partner_chemical_by_id(partner_chemical_id)
    if not existing:
        raise ValueError("Partner chemical not found")
    
    update_data = body.model_dump(exclude_unset=True)
    if not update_data:
        return existing
    
    # Convert UUIDs to strings
    from uuid import UUID
    def convert_uuids(obj):
        if isinstance(obj, UUID):
            return str(obj)
        elif isinstance(obj, dict):
            return {k: convert_uuids(v) for k, v in obj.items()}
        elif isinstance(obj, list):
            return [convert_uuids(item) for item in obj]
        return obj
    
    update_data = convert_uuids(update_data)
    
    response = (
        supabase.table("partner_chemicals")
        .update(update_data)
        .eq("id", partner_chemical_id)
        .execute()
    )
    if not response.data:
        raise RuntimeError("Failed to update partner chemical")
    return PartnerChemical(**response.data[0])


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
    """Fetch all unique product categories from partner_chemicals table."""
    supabase: Client = get_supabase_client()
    try:
        response = supabase.table("partner_chemicals").select("product_category").execute()
        categories_set = set()
        for row in response.data or []:
            cat = (row.get("product_category") or "").strip()
            if cat:
                categories_set.add(cat)
        return sorted(list(categories_set))
    except Exception:
        return []


def get_all_sub_categories() -> List[str]:
    """Fetch all unique sub categories from partner_chemicals table."""
    supabase: Client = get_supabase_client()
    try:
        response = supabase.table("partner_chemicals").select("sub_category").execute()
        sub_categories_set = set()
        for row in response.data or []:
            sub_cat = (row.get("sub_category") or "").strip()
            if sub_cat:
                sub_categories_set.add(sub_cat)
        return sorted(list(sub_categories_set))
    except Exception:
        return []


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
) -> List[ChemicalFullData]:
    """List chemical_full_data with optional filters."""
    supabase: Client = get_supabase_client()
    query = supabase.table("chemical_full_data").select("*")

    if sector:
        query = query.ilike("sector", f"%{sector}%")
    if industry:
        query = query.ilike("industry", f"%{industry}%")
    if vendor:
        query = query.ilike("vendor", f"%{vendor}%")
    if product_category:
        query = query.ilike("product_category", f"%{product_category}%")
    if sub_category:
        query = query.ilike("sub_category", f"%{sub_category}%")

    response = (
        query.order("id", desc=False)
        .limit(limit)
        .offset(offset)
        .execute()
    )
    return [ChemicalFullData(**row) for row in (response.data or [])]


def count_chemical_full_data(
    sector: Optional[str] = None,
    industry: Optional[str] = None,
    vendor: Optional[str] = None,
    product_category: Optional[str] = None,
    sub_category: Optional[str] = None,
) -> int:
    """Count chemical_full_data with optional filters."""
    supabase: Client = get_supabase_client()
    query = supabase.table("chemical_full_data").select("id", count="exact")

    if sector:
        query = query.ilike("sector", f"%{sector}%")
    if industry:
        query = query.ilike("industry", f"%{industry}%")
    if vendor:
        query = query.ilike("vendor", f"%{vendor}%")
    if product_category:
        query = query.ilike("product_category", f"%{product_category}%")
    if sub_category:
        query = query.ilike("sub_category", f"%{sub_category}%")

    response = query.execute()
    return response.count or 0


def create_chemical_full_data(body: ChemicalFullDataCreate) -> ChemicalFullData:
    """Create a new chemical_full_data record."""
    supabase: Client = get_supabase_client()
    payload = body.model_dump(exclude_unset=True)
    
    # Convert UUIDs to strings
    from uuid import UUID
    def convert_uuids(obj):
        if isinstance(obj, UUID):
            return str(obj)
        elif isinstance(obj, dict):
            return {k: convert_uuids(v) for k, v in obj.items()}
        elif isinstance(obj, list):
            return [convert_uuids(item) for item in obj]
        return obj
    
    payload = convert_uuids(payload)
    
    # If id is not provided, let the database auto-generate it
    if "id" not in payload or payload["id"] is None:
        # Get the max id and add 1
        max_response = supabase.table("chemical_full_data").select("id").order("id", desc=True).limit(1).execute()
        if max_response.data and len(max_response.data) > 0:
            payload["id"] = max_response.data[0]["id"] + 1
        else:
            payload["id"] = 1
    
    # If uuid_id is not provided, let the database auto-generate it (via default)
    # Don't set it explicitly - let the database default handle it
    
    response = supabase.table("chemical_full_data").insert(payload).execute()
    if not response.data:
        raise RuntimeError("Failed to create chemical_full_data")
    return ChemicalFullData(**response.data[0])


def get_chemical_full_data_by_id(chemical_id: int) -> Optional[ChemicalFullData]:
    """Get a single chemical_full_data by ID."""
    supabase: Client = get_supabase_client()
    response = (
        supabase.table("chemical_full_data")
        .select("*")
        .eq("id", chemical_id)
        .single()
        .execute()
    )
    if response.data:
        return ChemicalFullData(**response.data)
    return None


def update_chemical_full_data(chemical_id: int, body: ChemicalFullDataUpdate) -> ChemicalFullData:
    """Update an existing chemical_full_data record."""
    supabase: Client = get_supabase_client()
    payload = body.model_dump(exclude_unset=True)
    
    # Convert UUIDs to strings
    from uuid import UUID
    def convert_uuids(obj):
        if isinstance(obj, UUID):
            return str(obj)
        elif isinstance(obj, dict):
            return {k: convert_uuids(v) for k, v in obj.items()}
        elif isinstance(obj, list):
            return [convert_uuids(item) for item in obj]
        return obj
    
    payload = convert_uuids(payload)
    
    response = (
        supabase.table("chemical_full_data")
        .update(payload)
        .eq("id", chemical_id)
        .execute()
    )
    if not response.data:
        raise RuntimeError(f"Failed to update chemical_full_data with id {chemical_id}")
    return ChemicalFullData(**response.data[0])


def delete_chemical_full_data(chemical_id: int) -> bool:
    """Delete a chemical_full_data record."""
    supabase: Client = get_supabase_client()
    response = (
        supabase.table("chemical_full_data")
        .delete()
        .eq("id", chemical_id)
        .execute()
    )
    return True


def get_all_sectors() -> List[str]:
    """Fetch all unique sectors from chemical_full_data table."""
    supabase: Client = get_supabase_client()
    try:
        response = supabase.table("chemical_full_data").select("sector").execute()
        sectors_set = set()
        for row in response.data or []:
            sector = (row.get("sector") or "").strip()
            if sector:
                sectors_set.add(sector)
        return sorted(list(sectors_set))
    except Exception:
        return []


def get_all_industries() -> List[str]:
    """Fetch all unique industries from chemical_full_data table."""
    supabase: Client = get_supabase_client()
    try:
        response = supabase.table("chemical_full_data").select("industry").execute()
        industries_set = set()
        for row in response.data or []:
            industry = (row.get("industry") or "").strip()
            if industry:
                industries_set.add(industry)
        return sorted(list(industries_set))
    except Exception:
        return []


def get_all_product_names() -> List[str]:
    """Fetch all unique product names from chemical_full_data table."""
    supabase: Client = get_supabase_client()
    try:
        response = supabase.table("chemical_full_data").select("product_name").execute()
        names_set = set()
        for row in response.data or []:
            name = (row.get("product_name") or "").strip()
            if name:
                names_set.add(name)
        return sorted(list(names_set))
    except Exception:
        return []


def get_all_product_categories_from_full_data() -> List[str]:
    """Fetch all unique product categories from chemical_full_data table."""
    supabase: Client = get_supabase_client()
    try:
        response = supabase.table("chemical_full_data").select("product_category").execute()
        categories_set = set()
        for row in response.data or []:
            cat = (row.get("product_category") or "").strip()
            if cat:
                categories_set.add(cat)
        return sorted(list(categories_set))
    except Exception:
        return []


def get_all_sub_categories_from_full_data() -> List[str]:
    """Fetch all unique sub categories from chemical_full_data table."""
    supabase: Client = get_supabase_client()
    try:
        response = supabase.table("chemical_full_data").select("sub_category").execute()
        sub_categories_set = set()
        for row in response.data or []:
            sub_cat = (row.get("sub_category") or "").strip()
            if sub_cat:
                sub_categories_set.add(sub_cat)
        return sorted(list(sub_categories_set))
    except Exception:
        return []
 