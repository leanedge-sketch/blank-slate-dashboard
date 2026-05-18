"""
Stock Management Models
=======================

Pydantic models for stock management with three locations:
- Addis Ababa (Ethiopia): Full stock management with sales and purchases
- SEZ Kenya: Purchase and inter-company transfer only
- Nairobi Partner: Partner supplier stock tracking
"""

from pydantic import BaseModel, Field, field_validator
from datetime import datetime, date
from typing import Optional
from uuid import UUID

# Location constants
LOCATIONS = ["addis_ababa", "sez_kenya", "nairobi_partner"]

# Transaction type constants
TRANSACTION_TYPES = ["Sales", "Purchase", "Inter-company transfer", "Sample", "Damage", "Stock Availability"]

# Unit constants
UNITS = ["kg", "ton", "g", "lb", "oz", "piece", "unit"]

# Business model type constants (for Nairobi Partner)
BUSINESS_MODEL_TYPES = ["Stock", "Direct Delivery"]


class ProductBase(BaseModel):
    """Base product model with common fields."""
    chemical: str
    chemical_type: str
    brand: str
    packaging: str
    kg_per_unit: float = Field(gt=0, description="Kilograms per unit")
    use_case: str = Field(description="'sales' or 'internal'")
    tds_id: Optional[UUID] = Field(None, description="Link to TDS/product from PMS")
    tds_link: Optional[str] = None


class ProductCreate(ProductBase):
    """Model for creating a new product."""
    pass


class ProductUpdate(BaseModel):
    """Model for updating an existing product."""
    chemical: Optional[str] = None
    chemical_type: Optional[str] = None
    brand: Optional[str] = None
    packaging: Optional[str] = None
    kg_per_unit: Optional[float] = Field(None, gt=0)
    use_case: Optional[str] = None
    tds_id: Optional[UUID] = None
    tds_link: Optional[str] = None


class Product(ProductBase):
    """Full product model with id and timestamps."""
    id: UUID
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    
    # Stock state (computed by service) - three locations
    total_stock_addis_ababa: float = 0.0
    total_stock_sez_kenya: float = 0.0
    total_stock_nairobi_partner: float = 0.0
    reserved_stock_addis_ababa: float = 0.0
    reserved_stock_sez_kenya: float = 0.0
    reserved_stock_nairobi_partner: float = 0.0

    @property
    def available_stock_addis_ababa(self) -> float:
        return self.total_stock_addis_ababa - self.reserved_stock_addis_ababa

    @property
    def available_stock_sez_kenya(self) -> float:
        return self.total_stock_sez_kenya - self.reserved_stock_sez_kenya

    @property
    def available_stock_nairobi_partner(self) -> float:
        return self.total_stock_nairobi_partner - self.reserved_stock_nairobi_partner

    @property
    def total_stock(self) -> float:
        return (
            self.total_stock_addis_ababa +
            self.total_stock_sez_kenya +
            self.total_stock_nairobi_partner
        )

    @property
    def total_reserved_stock(self) -> float:
        return (
            self.reserved_stock_addis_ababa +
            self.reserved_stock_sez_kenya +
            self.reserved_stock_nairobi_partner
        )

    @property
    def total_available_stock(self) -> float:
        return self.total_stock - self.total_reserved_stock


class StockMovementBase(BaseModel):
    """Base stock movement model with all fields."""
    product_id: UUID
    tds_id: Optional[UUID] = Field(None, description="Link to TDS/product from PMS")
    date: date
    location: str = Field(description="'addis_ababa', 'sez_kenya', or 'nairobi_partner'")
    transaction_type: str = Field(description="'Sales', 'Purchase', 'Inter-company transfer', 'Sample', 'Damage', 'Stock Availability'")
    
    # Unit of measurement
    unit: str = Field(default="kg", description="Unit of measurement (kg, ton, g, lb, oz, piece, unit)")
    
    # Quantity fields
    beginning_balance: float = Field(default=0.0, ge=0, description="Beginning balance for this date")
    purchase_kg: float = Field(default=0.0, ge=0, description="Purchase quantity")
    sold_kg: float = Field(default=0.0, ge=0, description="Sold quantity")
    purchase_direct_shipment_kg: float = Field(default=0.0, ge=0, description="Purchase - Direct Shipment")
    sold_direct_shipment_kg: float = Field(default=0.0, ge=0, description="Sold - Direct Shipment")
    sample_or_damage_kg: float = Field(default=0.0, ge=0, description="Sample or Damage")
    inter_company_transfer_kg: float = Field(default=0.0, ge=0, description="Inter Company Transfer")
    
    # Transfer destination (for inter-company transfers from SEZ Kenya)
    transfer_to_location: Optional[str] = Field(None, description="Destination location for inter-company transfers (addis_ababa, sez_kenya, nairobi_partner)")
    
    # Calculated balance
    balance_kg: float = Field(description="Ending balance after this movement")
    
    # References
    supplier_id: Optional[UUID] = Field(None, description="Supplier from PMS (partner_data)")
    supplier_name: Optional[str] = Field(None, description="Supplier name (for display)")
    customer_id: Optional[UUID] = Field(None, description="Customer from CRM")
    customer_name: Optional[str] = Field(None, description="Customer name (for display)")
    
    # Business model (for Nairobi Partner)
    business_model: Optional[str] = Field(None, description="'Stock' or 'Direct Delivery' (for Nairobi Partner)")
    
    # Brand (from TDS selection)
    brand: Optional[str] = Field(None, description="Brand name from selected TDS")
    
    # Additional fields
    reference: Optional[str] = None
    remark: Optional[str] = None
    warehouse: Optional[str] = None

    @field_validator("location")
    @classmethod
    def validate_location(cls, v: str) -> str:
        if v not in LOCATIONS:
            raise ValueError(f"Location must be one of: {', '.join(LOCATIONS)}")
        return v

    @field_validator("transaction_type")
    @classmethod
    def validate_transaction_type(cls, v: str) -> str:
        if v not in TRANSACTION_TYPES:
            raise ValueError(f"Transaction type must be one of: {', '.join(TRANSACTION_TYPES)}")
        return v

    @field_validator("unit")
    @classmethod
    def validate_unit(cls, v: str) -> str:
        if v not in UNITS:
            raise ValueError(f"Unit must be one of: {', '.join(UNITS)}")
        return v

    @field_validator("business_model")
    @classmethod
    def validate_business_model(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and v not in BUSINESS_MODEL_TYPES:
            raise ValueError(f"Business model must be one of: {', '.join(BUSINESS_MODEL_TYPES)}")
        return v


class StockMovementCreate(StockMovementBase):
    """Model for creating a new stock movement."""
    # balance_kg is calculated by the service, so make it optional for creation
    balance_kg: Optional[float] = Field(None, description="Ending balance after this movement (calculated automatically)")


class StockMovementUpdate(BaseModel):
    """Model for updating an existing stock movement."""
    date: Optional[date] = None
    location: Optional[str] = None
    transaction_type: Optional[str] = None
    beginning_balance: Optional[float] = Field(None, ge=0)
    purchase_kg: Optional[float] = Field(None, ge=0)
    sold_kg: Optional[float] = Field(None, ge=0)
    purchase_direct_shipment_kg: Optional[float] = Field(None, ge=0)
    sold_direct_shipment_kg: Optional[float] = Field(None, ge=0)
    sample_or_damage_kg: Optional[float] = Field(None, ge=0)
    inter_company_transfer_kg: Optional[float] = Field(None, ge=0)
    transfer_to_location: Optional[str] = Field(None, description="Destination location for inter-company transfers (addis_ababa, sez_kenya, nairobi_partner)")
    balance_kg: Optional[float] = None
    supplier_id: Optional[UUID] = None
    supplier_name: Optional[str] = None
    customer_id: Optional[UUID] = None
    customer_name: Optional[str] = None
    business_model: Optional[str] = None
    brand: Optional[str] = None
    reference: Optional[str] = None
    remark: Optional[str] = None
    warehouse: Optional[str] = None


class StockMovement(StockMovementBase):
    """Full stock movement model with id and timestamps."""
    id: UUID
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


class ProductListResponse(BaseModel):
    """Response model for listing products with pagination."""
    products: list[Product]
    total: int
    limit: int
    offset: int


class StockMovementListResponse(BaseModel):
    """Response model for listing stock movements with pagination."""
    movements: list[StockMovement]
    total: int
    limit: int
    offset: int


class StockAvailabilitySummary(BaseModel):
    """Summary of stock availability by location."""
    product_id: UUID
    product_name: str
    chemical: str
    brand: str
    addis_ababa_stock: float
    sez_kenya_stock: float
    nairobi_partner_stock: float
    total_stock: float
    addis_ababa_reserved: float
    sez_kenya_reserved: float
    nairobi_partner_reserved: float
    total_reserved: float
    addis_ababa_available: float
    sez_kenya_available: float
    nairobi_partner_available: float
    total_available: float


class NairobiPartnerStock(BaseModel):
    """Nairobi Partner stock tracking model."""
    id: UUID
    supplier_id: UUID
    supplier_name: str
    product_id: UUID
    product_name: str
    quantity_kg: float
    date: date
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
