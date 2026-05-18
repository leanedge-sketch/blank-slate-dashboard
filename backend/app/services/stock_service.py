"""
Stock Management Service - Business Logic Layer
===============================================

This file contains the business logic for Stock Management operations with three locations:
- Addis Ababa (Ethiopia): Full stock management with sales and purchases
- SEZ Kenya: Purchase and inter-company transfer only
- Nairobi Partner: Partner supplier stock tracking
"""

from typing import List, Optional, Dict, Any
from datetime import datetime, date, timezone
from uuid import UUID
import json

from supabase import Client

from app.database.connection import get_supabase_client
from app.models.stock import (
    Product,
    ProductCreate,
    ProductUpdate,
    StockMovement,
    StockMovementCreate,
    StockMovementUpdate,
    StockAvailabilitySummary,
    LOCATIONS,
    TRANSACTION_TYPES,
)
from app.services.pms_service import get_tds_by_id
from app.services.crm_service import get_customer_by_id
from app.services.pms_service import get_partner_by_id


# =============================
# PRODUCTS
# =============================


def list_products(
    limit: int = 100,
    offset: int = 0,
    chemical: Optional[str] = None,
    brand: Optional[str] = None,
    use_case: Optional[str] = None,
) -> List[Product]:
    """
    List products with optional filters.
    
    Args:
        limit: Maximum number of records to return
        offset: Number of records to skip
        chemical: Filter by chemical name
        brand: Filter by brand
        use_case: Filter by use case ('sales' or 'internal')
    
    Returns:
        List of Product records with computed stock values for three locations
    """
    supabase: Client = get_supabase_client()
    query = supabase.table("products").select("*")
    
    # Apply filters
    if chemical:
        query = query.ilike("chemical", f"%{chemical}%")
    if brand:
        query = query.ilike("brand", f"%{brand}%")
    if use_case:
        query = query.eq("use_case", use_case)
    
    response = (
        query.order("created_at", desc=True)
        .limit(limit)
        .offset(offset)
        .execute()
    )
    
    if response.data is None:
        return []
    
    # Convert to Product models and compute stock
    products = []
    for row in response.data:
        product = Product(**row)
        # Compute stock from movements
        product = _compute_product_stock(product)
        products.append(product)
    
    return products


def count_products(
    chemical: Optional[str] = None,
    brand: Optional[str] = None,
    use_case: Optional[str] = None,
) -> int:
    """Count total products with optional filters."""
    supabase: Client = get_supabase_client()
    query = supabase.table("products").select("id", count="exact")
    
    if chemical:
        query = query.ilike("chemical", f"%{chemical}%")
    if brand:
        query = query.ilike("brand", f"%{brand}%")
    if use_case:
        query = query.eq("use_case", use_case)
    
    response = query.execute()
    return response.count or 0


def get_product_by_id(product_id: str) -> Optional[Product]:
    """Get a single product by ID with computed stock values."""
    supabase: Client = get_supabase_client()
    response = (
        supabase.table("products")
        .select("*")
        .eq("id", product_id)
        .single()
        .execute()
    )
    
    if not response.data:
        return None
    
    product = Product(**response.data)
    # Compute stock from movements
    product = _compute_product_stock(product)
    return product


def get_product_by_tds_id(tds_id: str) -> Optional[Product]:
    """Get a product by TDS ID with computed stock values."""
    supabase: Client = get_supabase_client()
    try:
        response = (
            supabase.table("products")
            .select("*")
            .eq("tds_id", tds_id)
            .limit(1)
            .execute()
        )
        
        if not response.data or len(response.data) == 0:
            return None
        
        product = Product(**response.data[0])
        # Compute stock from movements
        product = _compute_product_stock(product)
        return product
    except Exception:
        return None


def _convert_uuids_to_strings(obj):
    """Recursively convert UUID and date objects to strings in a dictionary/list."""
    if isinstance(obj, dict):
        return {k: _convert_uuids_to_strings(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [_convert_uuids_to_strings(item) for item in obj]
    elif isinstance(obj, UUID):
        return str(obj)
    elif isinstance(obj, (date, datetime)):
        return obj.isoformat()
    else:
        return obj


def create_product(body: ProductCreate) -> Product:
    """Create a new product."""
    supabase: Client = get_supabase_client()
    
    payload = body.model_dump()
    # Convert UUIDs to strings for JSON serialization
    payload = _convert_uuids_to_strings(payload)
    
    response = supabase.table("products").insert(payload).execute()
    if not response.data:
        raise RuntimeError("Failed to create product")
    
    product = Product(**response.data[0])
    return product


def update_product(product_id: str, body: ProductUpdate) -> Product:
    """Update an existing product."""
    supabase: Client = get_supabase_client()
    
    existing = get_product_by_id(product_id)
    if not existing:
        raise ValueError("Product not found")
    
    update_data = body.model_dump(exclude_unset=True)
    if not update_data:
        return existing
    
    update_data["updated_at"] = datetime.utcnow().isoformat()
    # Convert UUIDs to strings for JSON serialization
    update_data = _convert_uuids_to_strings(update_data)
    
    response = (
        supabase.table("products")
        .update(update_data)
        .eq("id", product_id)
        .execute()
    )
    
    if not response.data:
        raise RuntimeError("Failed to update product")
    
    product = Product(**response.data[0])
    product = _compute_product_stock(product)
    return product


def delete_product(product_id: str) -> bool:
    """Delete a product."""
    supabase: Client = get_supabase_client()
    
    existing = get_product_by_id(product_id)
    if not existing:
        raise ValueError("Product not found")
    
    response = (
        supabase.table("products")
        .delete()
        .eq("id", product_id)
        .execute()
    )
    
    return True


def _compute_product_stock(product: Product) -> Product:
    """
    Compute stock values for a product from stock movements for three locations.
    
    Args:
        product: Product model
    
    Returns:
        Product with computed stock values for all three locations
    """
    movements = list_stock_movements(
        product_id=str(product.id),
        limit=10000,  # Get all movements
    )
    
    # Initialize stock counters for three locations
    total_addis_ababa = 0.0
    total_sez_kenya = 0.0
    total_nairobi_partner = 0.0
    reserved_addis_ababa = 0.0
    reserved_sez_kenya = 0.0
    reserved_nairobi_partner = 0.0
    
    # Calculate from movements
    # For Nairobi Partner, track the latest Stock Availability entry
    nairobi_stock_availability = []
    
    for movement in movements:
        location = movement.location.lower()
        
        # For Stock Availability transaction type at Nairobi Partner, track it separately
        if movement.transaction_type == "Stock Availability" and location == "nairobi_partner":
            # Stock Availability represents the available stock at that point in time
            nairobi_stock_availability.append(movement)
        # Handle inter-company transfers from SEZ Kenya (special handling)
        elif movement.transaction_type == "Inter-company transfer" and location == "sez_kenya" and movement.inter_company_transfer_kg > 0:
            # Subtract from SEZ Kenya
            total_sez_kenya -= movement.inter_company_transfer_kg
            # Add to destination location
            if movement.transfer_to_location:
                transfer_to = movement.transfer_to_location.lower()
                if transfer_to == "addis_ababa":
                    total_addis_ababa += movement.inter_company_transfer_kg
                elif transfer_to == "sez_kenya":
                    total_sez_kenya += movement.inter_company_transfer_kg
                elif transfer_to == "nairobi_partner":
                    total_nairobi_partner += movement.inter_company_transfer_kg
        else:
            # Regular transaction handling
            # Note: inter_company_transfer_kg is only used for inter-company transfers from SEZ Kenya,
            # which are handled above, so we exclude it from net_change here
            net_change = (
                movement.purchase_kg +
                movement.purchase_direct_shipment_kg -
                movement.sold_kg -
                movement.sold_direct_shipment_kg -
                movement.sample_or_damage_kg
            )
            
            # Apply net change to the appropriate location
            if location == "addis_ababa":
                total_addis_ababa += net_change
            elif location == "sez_kenya":
                total_sez_kenya += net_change
            elif location == "nairobi_partner":
                # Only add to Nairobi Partner if it's not Stock Availability
                total_nairobi_partner += net_change
    
    # For Nairobi Partner, use the latest Stock Availability balance if available
    if nairobi_stock_availability:
        # Get the most recent Stock Availability entry by date
        # Use a timezone-aware min datetime for comparison
        min_datetime = datetime.min.replace(tzinfo=timezone.utc)
        latest_stock_avail = max(
            nairobi_stock_availability,
            key=lambda m: (m.date, m.created_at if m.created_at else min_datetime)
        )
        total_nairobi_partner = latest_stock_avail.balance_kg
    
    # Update product stock values
    product.total_stock_addis_ababa = max(0.0, total_addis_ababa)
    product.total_stock_sez_kenya = max(0.0, total_sez_kenya)
    product.total_stock_nairobi_partner = max(0.0, total_nairobi_partner)
    product.reserved_stock_addis_ababa = reserved_addis_ababa
    product.reserved_stock_sez_kenya = reserved_sez_kenya
    product.reserved_stock_nairobi_partner = reserved_nairobi_partner
    
    return product


# =============================
# STOCK MOVEMENTS
# =============================


def list_stock_movements(
    limit: int = 100,
    offset: int = 0,
    product_id: Optional[str] = None,
    location: Optional[str] = None,
    transaction_type: Optional[str] = None,
    business_model: Optional[str] = None,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
) -> List[StockMovement]:
    """
    List stock movements with optional filters.
    
    Args:
        limit: Maximum number of records to return
        offset: Number of records to skip
        product_id: Filter by product ID
        location: Filter by location
        transaction_type: Filter by transaction type
        business_model: Filter by business model
        start_date: Filter by start date
        end_date: Filter by end date
    
    Returns:
        List of StockMovement records
    """
    supabase: Client = get_supabase_client()
    query = supabase.table("stock_movements").select("*")
    
    # Apply filters
    if product_id:
        query = query.eq("product_id", product_id)
    if location:
        query = query.eq("location", location.lower())
    if transaction_type:
        query = query.eq("transaction_type", transaction_type)
    if business_model:
        query = query.eq("business_model", business_model)
    if start_date:
        query = query.gte("date", start_date.isoformat())
    if end_date:
        query = query.lte("date", end_date.isoformat())
    
    response = (
        query.order("date", desc=True)
        .order("created_at", desc=True)
        .limit(limit)
        .offset(offset)
        .execute()
    )
    
    if response.data is None:
        return []
    
    return [StockMovement(**row) for row in response.data]


def count_stock_movements(
    product_id: Optional[str] = None,
    location: Optional[str] = None,
    transaction_type: Optional[str] = None,
    business_model: Optional[str] = None,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
) -> int:
    """Count total stock movements with optional filters."""
    supabase: Client = get_supabase_client()
    query = supabase.table("stock_movements").select("id", count="exact")
    
    if product_id:
        query = query.eq("product_id", product_id)
    if location:
        query = query.eq("location", location.lower())
    if transaction_type:
        query = query.eq("transaction_type", transaction_type)
    if business_model:
        query = query.eq("business_model", business_model)
    if start_date:
        query = query.gte("date", start_date.isoformat())
    if end_date:
        query = query.lte("date", end_date.isoformat())
    
    response = query.execute()
    return response.count or 0


def get_stock_movement_by_id(movement_id: str) -> Optional[StockMovement]:
    """Get a single stock movement by ID."""
    supabase: Client = get_supabase_client()
    response = (
        supabase.table("stock_movements")
        .select("*")
        .eq("id", movement_id)
        .single()
        .execute()
    )
    
    if not response.data:
        return None
    
    return StockMovement(**response.data)


def create_stock_movement(body: StockMovementCreate) -> StockMovement:
    """
    Create a new stock movement with business logic validation.
    
    Business Rules:
    - If transaction_type is "Sales", purchase fields must be 0
    - If transaction_type is "Purchase", sales fields must be 0
    - SEZ Kenya can only have Purchase and Inter-company transfer
    - Nairobi Partner can only have "Stock Availability" transaction type
    - Balance is calculated from beginning_balance + all additions - all subtractions
    """
    supabase: Client = get_supabase_client()
    
    # Validate product exists
    product = get_product_by_id(str(body.product_id))
    if not product:
        raise ValueError("Product not found")
    
    # Validate transaction type for location
    if body.location == "nairobi_partner" and body.transaction_type != "Stock Availability":
        raise ValueError("Nairobi Partner location can only have 'Stock Availability' transaction type")
    
    if body.location != "nairobi_partner" and body.transaction_type == "Stock Availability":
        raise ValueError("'Stock Availability' transaction type is only allowed for Nairobi Partner location")
    
    # Validate TDS if provided
    if body.tds_id:
        tds = get_tds_by_id(str(body.tds_id))
        if not tds:
            raise ValueError("TDS not found")
    
    # Validate supplier if provided (for Purchase transactions)
    if body.supplier_id:
        supplier = get_partner_by_id(str(body.supplier_id))
        if not supplier:
            raise ValueError("Supplier not found")
        # Populate supplier_name if not provided
        if not body.supplier_name and supplier.partner:
            body.supplier_name = supplier.partner
    
    # Validate customer if provided (for Sales transactions)
    if body.customer_id:
        customer = get_customer_by_id(str(body.customer_id))
        if not customer:
            raise ValueError("Customer not found")
        # Populate customer_name if not provided
        if not body.customer_name and customer.customer_name:
            body.customer_name = customer.customer_name
    
    # Get previous balance for beginning_balance if not provided
    # For Stock Availability, we don't need previous balance
    if body.beginning_balance == 0.0 and body.transaction_type != "Stock Availability":
        movements = list_stock_movements(
            product_id=str(body.product_id),
            limit=10000,  # Get all movements for this product
        )
        
        if movements:
            # Calculate the current balance for this location by considering:
            # 1. All movements at this location
            # 2. All inter-company transfers TO this location
            target_location = body.location.lower()
            
            # Get all movements that affect this location's stock
            # Direct movements at this location
            direct_movements = [m for m in movements if m.location.lower() == target_location]
            # Inter-company transfers TO this location
            transfers_to = [
                m for m in movements 
                if (m.transaction_type == "Inter-company transfer" and 
                    m.transfer_to_location and 
                    m.transfer_to_location.lower() == target_location)
            ]
            
            # Combine and sort by date
            all_affecting = direct_movements + transfers_to
            # Use a timezone-aware min datetime for sorting
            min_datetime = datetime.min.replace(tzinfo=timezone.utc)
            all_affecting.sort(key=lambda m: (m.date, m.created_at if m.created_at else min_datetime))
            
            # Filter to only movements before the current one
            # Get current time for comparison (timezone-aware UTC)
            now_utc = datetime.now(timezone.utc)
            previous_movements = []
            for m in all_affecting:
                # Compare dates first
                if m.date < body.date:
                    previous_movements.append(m)
                elif m.date == body.date:
                    # If dates are equal, compare created_at timestamps
                    if m.created_at:
                        # Handle both string and datetime objects
                        if isinstance(m.created_at, str):
                            m_created = datetime.fromisoformat(m.created_at.replace('Z', '+00:00'))
                        else:
                            m_created = m.created_at
                        # Make sure both are timezone-aware for comparison
                        if m_created.tzinfo is None:
                            m_created = m_created.replace(tzinfo=timezone.utc)
                        if m_created < now_utc:
                            previous_movements.append(m)
                    else:
                        # No created_at, treat as before current time
                        previous_movements.append(m)
            
            if previous_movements:
                # Find the latest direct movement (if any) - its balance_kg already includes transfers
                latest_direct = None
                for m in reversed(previous_movements):
                    if m.location.lower() == target_location:
                        latest_direct = m
                        break
                
                if latest_direct:
                    # Use the balance from the latest direct movement
                    # (it already accounts for all previous transfers and movements)
                    body.beginning_balance = latest_direct.balance_kg
                else:
                    # No direct movements yet, calculate from transfers only
                    total_from_transfers = sum(m.inter_company_transfer_kg for m in transfers_to if m in previous_movements)
                    body.beginning_balance = total_from_transfers
    
    # Calculate balance based on transaction type
    if body.transaction_type == "Stock Availability":
        # For Stock Availability, balance is the stock quantity itself (beginning_balance)
        balance = body.beginning_balance
    elif body.transaction_type == "Inter-company transfer" and body.location.lower() == "sez_kenya":
        # For inter-company transfers FROM SEZ Kenya, subtract from SEZ Kenya
        # The destination location will be handled separately
        balance = (
            body.beginning_balance -
            body.inter_company_transfer_kg
        )
    else:
        # For other transaction types, calculate normally
        # Note: inter_company_transfer_kg is only used for transfers FROM SEZ Kenya,
        # transfers TO a location are handled via transfer_to_location
        balance = (
            body.beginning_balance +
            body.purchase_kg +
            body.purchase_direct_shipment_kg -
            body.sold_kg -
            body.sold_direct_shipment_kg -
            body.sample_or_damage_kg
        )
        
        # If there are inter-company transfers TO this location, add them
        if body.transfer_to_location and body.transfer_to_location.lower() == body.location.lower():
            balance += body.inter_company_transfer_kg
    
    # Create payload
    payload = body.model_dump(exclude_none=False)
    
    # Debug: Check if brand is in model_dump
    print(f"DEBUG: body.brand value: {body.brand}")
    print(f"DEBUG: model_dump keys before modification: {list(payload.keys())}")
    print(f"DEBUG: brand in model_dump: {'brand' in payload}, value: {payload.get('brand')}")
    
    payload["balance_kg"] = max(0.0, balance)
    payload["location"] = body.location.lower()  # Normalize to lowercase
    
    # ALWAYS explicitly set brand if it exists in body (override model_dump if needed)
    if hasattr(body, 'brand') and body.brand:
        payload["brand"] = str(body.brand).strip()  # Ensure it's a string and not empty
        print(f"DEBUG: Explicitly set brand in payload: {payload['brand']}")
    elif hasattr(body, 'brand'):
        print(f"DEBUG: body.brand exists but is falsy: {body.brand}")
    
    # Convert UUIDs to strings for JSON serialization
    payload = _convert_uuids_to_strings(payload)
    
    # Final check
    print(f"DEBUG: Final payload keys: {list(payload.keys())}")
    if "brand" in payload:
        print(f"DEBUG: Final brand value: '{payload['brand']}'")
    else:
        print(f"DEBUG: ERROR - Brand still NOT in final payload!")
    
    response = supabase.table("stock_movements").insert(payload).execute()
    if not response.data:
        raise RuntimeError("Failed to create stock movement")
    
    created_movement = StockMovement(**response.data[0])
    
    # Recalculate balances for both source and destination locations
    # This ensures inter-company transfers are properly reflected in balances
    _recalculate_balances(str(body.product_id), body.location.lower())
    if (body.transaction_type == "Inter-company transfer" and 
        body.transfer_to_location):
        _recalculate_balances(str(body.product_id), body.transfer_to_location.lower())
    
    # Reload the movement to get the recalculated balance
    return get_stock_movement_by_id(str(created_movement.id))


def update_stock_movement(movement_id: str, body: StockMovementUpdate) -> StockMovement:
    """
    Update an existing stock movement.
    If quantity fields changed, balances are automatically recalculated.
    """
    supabase: Client = get_supabase_client()
    
    existing = get_stock_movement_by_id(movement_id)
    if not existing:
        raise ValueError("Stock movement not found")
    
    update_data = body.model_dump(exclude_unset=True)
    if not update_data:
        return existing
    
    # If quantity fields changed, recalculate balance
    quantity_fields = [
        "beginning_balance", "purchase_kg", "sold_kg",
        "purchase_direct_shipment_kg", "sold_direct_shipment_kg",
        "sample_or_damage_kg", "inter_company_transfer_kg"
    ]
    
    if any(field in update_data for field in quantity_fields):
        # Recalculate all balances for this product and location
        _recalculate_balances(str(existing.product_id), existing.location)
        # If this is an inter-company transfer, also recalculate destination location
        if (existing.transaction_type == "Inter-company transfer" and 
            existing.transfer_to_location):
            _recalculate_balances(str(existing.product_id), existing.transfer_to_location.lower())
        # Reload the movement
        existing = get_stock_movement_by_id(movement_id)
        if not existing:
            raise ValueError("Stock movement not found after recalculation")
        return existing
    
    update_data["updated_at"] = datetime.utcnow().isoformat()
    # Convert UUIDs to strings for JSON serialization
    update_data = _convert_uuids_to_strings(update_data)
    
    response = (
        supabase.table("stock_movements")
        .update(update_data)
        .eq("id", movement_id)
        .execute()
    )
    
    if not response.data:
        raise RuntimeError("Failed to update stock movement")
    
    return StockMovement(**response.data[0])


def delete_stock_movement(movement_id: str) -> bool:
    """Delete a stock movement. Balances are automatically recalculated."""
    supabase: Client = get_supabase_client()
    
    existing = get_stock_movement_by_id(movement_id)
    if not existing:
        raise ValueError("Stock movement not found")
    
    product_id = str(existing.product_id)
    location = existing.location
    transfer_to_location = existing.transfer_to_location
    
    response = (
        supabase.table("stock_movements")
        .delete()
        .eq("id", movement_id)
        .execute()
    )
    
    # Recalculate balances after deletion
    _recalculate_balances(product_id, location)
    # If this was an inter-company transfer, also recalculate destination location
    if (existing.transaction_type == "Inter-company transfer" and 
        transfer_to_location):
        _recalculate_balances(product_id, transfer_to_location.lower())
    
    return True


def _recalculate_balances(product_id: str, location: str):
    """
    Recalculate all balances for a product and location after a change.
    Uses beginning_balance and all quantity fields to calculate running balance.
    Also considers inter-company transfers TO this location.
    """
    supabase: Client = get_supabase_client()
    
    # Get all movements for this product (all locations)
    all_movements = list_stock_movements(
        product_id=product_id,
        limit=10000,
    )
    
    # Filter movements that affect this location:
    # 1. Movements at this location
    # 2. Inter-company transfers TO this location
    location_movements = []
    for m in all_movements:
        if m.location.lower() == location.lower():
            location_movements.append(("direct", m))
        elif (m.transaction_type == "Inter-company transfer" and 
              m.transfer_to_location and 
              m.transfer_to_location.lower() == location.lower()):
            location_movements.append(("transfer_to", m))
    
    # Sort by date and created_at
    min_datetime = datetime.min.replace(tzinfo=timezone.utc)
    location_movements.sort(key=lambda x: (x[1].date, x[1].created_at if x[1].created_at else min_datetime))
    
    # Recalculate balances sequentially
    for i, (movement_type, movement) in enumerate(location_movements):
        if i == 0:
            # First movement uses its beginning_balance
            current_balance = movement.beginning_balance
        else:
            # Subsequent movements use previous balance as beginning
            prev_type, prev_movement = location_movements[i-1]
            current_balance = prev_movement.balance_kg
        
        # Calculate new balance based on movement type
        if movement_type == "direct":
            # Direct movement at this location
            # For inter-company transfers FROM this location, subtract
            if movement.transaction_type == "Inter-company transfer" and movement.location.lower() == location.lower():
                new_balance = current_balance - movement.inter_company_transfer_kg
            else:
                # Regular transaction
                new_balance = (
                    current_balance +
                    movement.purchase_kg +
                    movement.purchase_direct_shipment_kg -
                    movement.sold_kg -
                    movement.sold_direct_shipment_kg -
                    movement.sample_or_damage_kg
                )
        elif movement_type == "transfer_to":
            # Inter-company transfer TO this location - add the transfer amount
            new_balance = current_balance + movement.inter_company_transfer_kg
        
        # Update the balance in database
        supabase.table("stock_movements").update({
            "balance_kg": max(0.0, new_balance),
            "beginning_balance": current_balance
        }).eq("id", str(movement.id)).execute()


# =============================
# STOCK AVAILABILITY SUMMARY
# =============================


def get_stock_availability_summary(
    limit: int = 100,
    offset: int = 0,
    chemical: Optional[str] = None,
    brand: Optional[str] = None,
) -> List[StockAvailabilitySummary]:
    """
    Get stock availability summary for all products, grouped by three locations.
    
    Args:
        limit: Maximum number of records to return
        offset: Number of records to skip
        chemical: Filter by chemical name
        brand: Filter by brand
    
    Returns:
        List of StockAvailabilitySummary with stock by three locations
    """
    products = list_products(
        limit=limit,
        offset=offset,
        chemical=chemical,
        brand=brand,
    )
    
    summaries = []
    for product in products:
        summary = StockAvailabilitySummary(
            product_id=product.id,
            product_name=f"{product.chemical} - {product.brand}",
            chemical=product.chemical,
            brand=product.brand,
            addis_ababa_stock=product.total_stock_addis_ababa,
            sez_kenya_stock=product.total_stock_sez_kenya,
            nairobi_partner_stock=product.total_stock_nairobi_partner,
            total_stock=product.total_stock,
            addis_ababa_reserved=product.reserved_stock_addis_ababa,
            sez_kenya_reserved=product.reserved_stock_sez_kenya,
            nairobi_partner_reserved=product.reserved_stock_nairobi_partner,
            total_reserved=product.total_reserved_stock,
            addis_ababa_available=product.available_stock_addis_ababa,
            sez_kenya_available=product.available_stock_sez_kenya,
            nairobi_partner_available=product.available_stock_nairobi_partner,
            total_available=product.total_available_stock,
        )
        summaries.append(summary)
    
    return summaries
