"""
Stock Management API Routes
===========================

HTTP endpoints for Stock Management functionality:
- GET  /stock/products                    → list products
- GET  /stock/products/{product_id}        → get single product
- POST /stock/products                    → create new product
- PUT  /stock/products/{product_id}       → update product
- DELETE /stock/products/{product_id}      → delete product
- GET  /stock/movements                    → list stock movements
- GET  /stock/movements/{movement_id}     → get single movement
- POST /stock/movements                    → create new movement
- PUT  /stock/movements/{movement_id}      → update movement
- DELETE /stock/movements/{movement_id}    → delete movement
- GET  /stock/availability                 → get stock availability summary
"""

from typing import Optional
from datetime import date

from fastapi import APIRouter, HTTPException, Query

from app.models.stock import (
    Product,
    ProductCreate,
    ProductUpdate,
    ProductListResponse,
    StockMovement,
    StockMovementCreate,
    StockMovementUpdate,
    StockMovementListResponse,
    StockAvailabilitySummary,
)
from app.services.stock_service import (
    list_products,
    count_products,
    get_product_by_id,
    get_product_by_tds_id,
    create_product,
    update_product,
    delete_product,
    list_stock_movements,
    count_stock_movements,
    get_stock_movement_by_id,
    create_stock_movement,
    update_stock_movement,
    delete_stock_movement,
    get_stock_availability_summary,
)
from app.dependencies import get_current_user

router = APIRouter()


# =============================
# PRODUCTS
# =============================


@router.get("/stock/products", response_model=ProductListResponse)
async def list_products_endpoint(
    limit: int = Query(100, ge=1, le=1000),
    offset: int = Query(0, ge=0),
    chemical: Optional[str] = Query(None, description="Filter by chemical name"),
    brand: Optional[str] = Query(None, description="Filter by brand"),
    use_case: Optional[str] = Query(None, description="Filter by use case ('sales' or 'internal')"),
    # user: dict = Depends(get_current_user)
):
    """
    List products with optional filters.
    Returns products with computed stock values for three locations:
    - Addis Ababa (Ethiopia)
    - SEZ Kenya
    - Nairobi Partner
    """
    try:
        products = list_products(
            limit=limit,
            offset=offset,
            chemical=chemical,
            brand=brand,
            use_case=use_case,
        )
        total = count_products(
            chemical=chemical,
            brand=brand,
            use_case=use_case,
        )
        return ProductListResponse(
            products=products,
            total=total,
            limit=limit,
            offset=offset,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error listing products: {str(e)}")


@router.get("/stock/products/{product_id}", response_model=Product)
async def get_product_endpoint(
    product_id: str,
    # user: dict = Depends(get_current_user)
):
    """Get a single product by ID with computed stock values."""
    try:
        product = get_product_by_id(product_id)
        if not product:
            raise HTTPException(status_code=404, detail="Product not found")
        return product
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching product: {str(e)}")


@router.get("/stock/products/by-tds/{tds_id}", response_model=Product)
async def get_product_by_tds_endpoint(
    tds_id: str,
    # user: dict = Depends(get_current_user)
):
    """Get a product by TDS ID with computed stock values."""
    try:
        product = get_product_by_tds_id(tds_id)
        if not product:
            raise HTTPException(status_code=404, detail="Product not found for this TDS")
        return product
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching product: {str(e)}")


@router.post("/stock/products", response_model=Product, status_code=201)
async def create_product_endpoint(
    body: ProductCreate,
    # user: dict = Depends(get_current_user)
):
    """Create a new product."""
    try:
        return create_product(body)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error creating product: {str(e)}")


@router.put("/stock/products/{product_id}", response_model=Product)
async def update_product_endpoint(
    product_id: str,
    body: ProductUpdate,
    # user: dict = Depends(get_current_user)
):
    """Update an existing product."""
    try:
        return update_product(product_id, body)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error updating product: {str(e)}")


@router.delete("/stock/products/{product_id}", status_code=204)
async def delete_product_endpoint(
    product_id: str,
    # user: dict = Depends(get_current_user)
):
    """Delete a product."""
    try:
        delete_product(product_id)
        return None
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error deleting product: {str(e)}")


# =============================
# STOCK MOVEMENTS
# =============================


@router.get("/stock/movements", response_model=StockMovementListResponse)
async def list_stock_movements_endpoint(
    limit: int = Query(100, ge=1, le=1000),
    offset: int = Query(0, ge=0),
    product_id: Optional[str] = Query(None, description="Filter by product ID"),
    location: Optional[str] = Query(None, description="Filter by location ('addis_ababa', 'sez_kenya', or 'nairobi_partner')"),
    transaction_type: Optional[str] = Query(None, description="Filter by transaction type"),
    business_model: Optional[str] = Query(None, description="Filter by business model"),
    start_date: Optional[date] = Query(None, description="Filter by start date"),
    end_date: Optional[date] = Query(None, description="Filter by end date"),
    # user: dict = Depends(get_current_user)
):
    """
    List stock movements with optional filters.
    Returns movements ordered by date (newest first).
    """
    try:
        movements = list_stock_movements(
            limit=limit,
            offset=offset,
            product_id=product_id,
            location=location,
            transaction_type=transaction_type,
            business_model=business_model,
            start_date=start_date,
            end_date=end_date,
        )
        total = count_stock_movements(
            product_id=product_id,
            location=location,
            transaction_type=transaction_type,
            business_model=business_model,
            start_date=start_date,
            end_date=end_date,
        )
        return StockMovementListResponse(
            movements=movements,
            total=total,
            limit=limit,
            offset=offset,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error listing stock movements: {str(e)}")


@router.get("/stock/movements/{movement_id}", response_model=StockMovement)
async def get_stock_movement_endpoint(
    movement_id: str,
    # user: dict = Depends(get_current_user)
):
    """Get a single stock movement by ID."""
    try:
        movement = get_stock_movement_by_id(movement_id)
        if not movement:
            raise HTTPException(status_code=404, detail="Stock movement not found")
        return movement
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching stock movement: {str(e)}")


@router.post("/stock/movements", response_model=StockMovement, status_code=201)
async def create_stock_movement_endpoint(
    body: StockMovementCreate,
    # user: dict = Depends(get_current_user)
):
    """
    Create a new stock movement.
    Balance is automatically calculated based on beginning_balance and all quantity fields.
    Business rules are enforced:
    - If transaction_type is "Sales", purchase fields must be 0
    - If transaction_type is "Purchase", sales fields must be 0
    - SEZ Kenya can only have Purchase and Inter-company transfer transactions
    """
    try:
        return create_stock_movement(body)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error creating stock movement: {str(e)}")


@router.put("/stock/movements/{movement_id}", response_model=StockMovement)
async def update_stock_movement_endpoint(
    movement_id: str,
    body: StockMovementUpdate,
    # user: dict = Depends(get_current_user)
):
    """
    Update an existing stock movement.
    If quantity fields are changed, balances are automatically recalculated.
    Business rules are enforced:
    - If transaction_type is "Sales", purchase fields must be 0
    - If transaction_type is "Purchase", sales fields must be 0
    """
    try:
        return update_stock_movement(movement_id, body)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error updating stock movement: {str(e)}")


@router.delete("/stock/movements/{movement_id}", status_code=204)
async def delete_stock_movement_endpoint(
    movement_id: str,
    # user: dict = Depends(get_current_user)
):
    """
    Delete a stock movement.
    Balances are automatically recalculated after deletion.
    """
    try:
        delete_stock_movement(movement_id)
        return None
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error deleting stock movement: {str(e)}")


# =============================
# STOCK AVAILABILITY SUMMARY
# =============================


@router.get("/stock/availability", response_model=list[StockAvailabilitySummary])
async def get_stock_availability_summary_endpoint(
    limit: int = Query(100, ge=1, le=1000),
    offset: int = Query(0, ge=0),
    chemical: Optional[str] = Query(None, description="Filter by chemical name"),
    brand: Optional[str] = Query(None, description="Filter by brand"),
    # user: dict = Depends(get_current_user)
):
    """
    Get stock availability summary for all products.
    Returns stock totals and availability for three locations:
    - Addis Ababa (Ethiopia)
    - SEZ Kenya
    - Nairobi Partner
    """
    try:
        return get_stock_availability_summary(
            limit=limit,
            offset=offset,
            chemical=chemical,
            brand=brand,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error getting stock availability: {str(e)}")

