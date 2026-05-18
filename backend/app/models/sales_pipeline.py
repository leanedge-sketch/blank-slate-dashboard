"""
Sales Pipeline Data Models (Pydantic Schemas)
============================================

These models describe the Sales Pipeline entities:
- sales_pipeline

They are thin "contracts" between the FastAPI layer and the outside world.
"""

from datetime import datetime, date
from typing import Optional, List, Dict, Any
from uuid import UUID

from pydantic import BaseModel, Field, field_validator, model_validator


# =============================
# PIPELINE STAGES (Enum-like constants)
# =============================

PIPELINE_STAGES = [
    "Lead ID",
    "Discovery",
    "Sample",
    "Validation",
    "Proposal",
    "Confirmation",
    "Closed",
    "Lost",
]

# Stages that require business_model, unit, and unit_price
STAGES_REQUIRING_BUSINESS_DETAILS = ["Validation", "Proposal", "Confirmation", "Closed"]

# Currency options
CURRENCIES = ["ETB", "KES", "USD", "EUR"]

# Forex options
FOREX_OPTIONS = ["LeanChems", "Client"]

# Business Unit options
BUSINESS_UNIT_OPTIONS = ["Hayat", "Alhadi", "Bet-chem", "Barracoda", "Nyumb-Chem"]

# Incoterm options
INCOTERM_OPTIONS = ["Import of Record", "Agency", "Direct Import", "Stock – Addis Ababa"]


# =============================
# SALES PIPELINE
# =============================


class SalesPipelineBase(BaseModel):
    customer_id: UUID
    tds_id: Optional[UUID] = None
    chemical_type_id: Optional[UUID] = None
    stage: str
    amount: Optional[float] = Field(None, ge=0, description="Amount")
    expected_close_date: Optional[date] = None
    close_reason: Optional[str] = None
    lead_source: Optional[str] = None
    contact_per_lead: Optional[str] = None
    business_model: Optional[str] = None
    unit: Optional[str] = None
    unit_price: Optional[float] = Field(None, ge=0, description="Price per unit")
    currency: Optional[str] = Field(None, description="Currency code: ETB, KES, USD, EUR")
    forex: Optional[str] = Field(None, description="Forex risk bearer: LeanChems or Client")
    business_unit: Optional[str] = Field(None, description="Business Unit: Hayat, Alhadi, Bet-chem, Barracoda, or Nyumb-Chem")
    incoterm: Optional[str] = Field(None, description="Incoterm: Import of Record, Agency, Direct Import, or Stock – Addis Ababa")
    metadata: Optional[Dict[str, Any]] = None

    @field_validator("stage")
    @classmethod
    def validate_stage(cls, v: str) -> str:
        """Validate that stage is one of the allowed values."""
        if v not in PIPELINE_STAGES:
            raise ValueError(
                f"Stage must be one of: {', '.join(PIPELINE_STAGES)}"
            )
        return v

    @field_validator("currency")
    @classmethod
    def validate_currency(cls, v: Optional[str]) -> Optional[str]:
        """Validate that currency is one of the allowed values."""
        if v is not None and v not in CURRENCIES:
            raise ValueError(
                f"Currency must be one of: {', '.join(CURRENCIES)}"
            )
        return v

    @field_validator("forex")
    @classmethod
    def validate_forex(cls, v: Optional[str]) -> Optional[str]:
        """Validate that forex is one of the allowed values."""
        if v is not None and v not in FOREX_OPTIONS:
            raise ValueError(
                f"Forex must be one of: {', '.join(FOREX_OPTIONS)}"
            )
        return v

    @field_validator("business_unit")
    @classmethod
    def validate_business_unit(cls, v: Optional[str]) -> Optional[str]:
        """Validate that business_unit is one of the allowed values."""
        if v is not None and v not in BUSINESS_UNIT_OPTIONS:
            raise ValueError(
                f"Business Unit must be one of: {', '.join(BUSINESS_UNIT_OPTIONS)}"
            )
        return v

    @field_validator("incoterm")
    @classmethod
    def validate_incoterm(cls, v: Optional[str]) -> Optional[str]:
        """Validate that incoterm is one of the allowed values."""
        if v is not None and v not in INCOTERM_OPTIONS:
            raise ValueError(
                f"Incoterm must be one of: {', '.join(INCOTERM_OPTIONS)}"
            )
        return v

    @field_validator("incoterm")
    @classmethod
    def validate_incoterm(cls, v: Optional[str]) -> Optional[str]:
        """Validate that incoterm is one of the allowed values."""
        if v is not None and v not in INCOTERM_OPTIONS:
            raise ValueError(
                f"Incoterm must be one of: {', '.join(INCOTERM_OPTIONS)}"
            )
        return v

    @model_validator(mode="after")
    def validate_business_details_for_validation_plus(self):
        """Validate that business_model, unit, and unit_price are provided for Validation+ stages."""
        if self.stage in STAGES_REQUIRING_BUSINESS_DETAILS:
            if not self.business_model or not self.business_model.strip():
                raise ValueError("business_model is required for stages: Validation, Proposal, Confirmation, Closed")
            if not self.unit or not self.unit.strip():
                raise ValueError("unit is required for stages: Validation, Proposal, Confirmation, Closed")
            if self.unit_price is None or self.unit_price < 0:
                raise ValueError("unit_price is required and must be >= 0 for stages: Validation, Proposal, Confirmation, Closed")
        return self

    @model_validator(mode="after")
    def validate_close_reason_for_closed(self):
        """Validate that close_reason is provided when stage is Closed."""
        if self.stage == "Closed" and (not self.close_reason or not self.close_reason.strip()):
            raise ValueError("close_reason is required when stage is 'Closed'")
        return self


class SalesPipelineCreate(SalesPipelineBase):
    """Model for creating a new sales pipeline record."""
    pass


class SalesPipelineUpdate(BaseModel):
    """Model for updating an existing sales pipeline record."""
    customer_id: Optional[UUID] = None
    tds_id: Optional[UUID] = None
    chemical_type_id: Optional[UUID] = None
    stage: Optional[str] = None
    amount: Optional[float] = Field(None, ge=0)
    currency: Optional[str] = None
    expected_close_date: Optional[date] = None
    close_reason: Optional[str] = None
    lead_source: Optional[str] = None
    contact_per_lead: Optional[str] = None
    business_model: Optional[str] = None
    unit: Optional[str] = None
    unit_price: Optional[float] = Field(None, ge=0)
    forex: Optional[str] = None
    business_unit: Optional[str] = None
    incoterm: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None
    reason_for_stage_change: Optional[str] = Field(None, description="Required when stage changes")
    reason_for_amount_change: Optional[str] = Field(None, description="Required when amount changes")

    @field_validator("stage")
    @classmethod
    def validate_stage(cls, v: Optional[str]) -> Optional[str]:
        """Validate that stage is one of the allowed values."""
        if v is not None and v not in PIPELINE_STAGES:
            raise ValueError(
                f"Stage must be one of: {', '.join(PIPELINE_STAGES)}"
            )
        return v

    @field_validator("currency")
    @classmethod
    def validate_currency(cls, v: Optional[str]) -> Optional[str]:
        """Validate that currency is one of the allowed values."""
        if v is not None and v not in CURRENCIES:
            raise ValueError(
                f"Currency must be one of: {', '.join(CURRENCIES)}"
            )
        return v

    @field_validator("forex")
    @classmethod
    def validate_forex(cls, v: Optional[str]) -> Optional[str]:
        """Validate that forex is one of the allowed values."""
        if v is not None and v not in FOREX_OPTIONS:
            raise ValueError(
                f"Forex must be one of: {', '.join(FOREX_OPTIONS)}"
            )
        return v

    @field_validator("business_unit")
    @classmethod
    def validate_business_unit(cls, v: Optional[str]) -> Optional[str]:
        """Validate that business_unit is one of the allowed values."""
        if v is not None and v not in BUSINESS_UNIT_OPTIONS:
            raise ValueError(
                f"Business Unit must be one of: {', '.join(BUSINESS_UNIT_OPTIONS)}"
            )
        return v

    @field_validator("incoterm")
    @classmethod
    def validate_incoterm(cls, v: Optional[str]) -> Optional[str]:
        """Validate that incoterm is one of the allowed values."""
        if v is not None and v not in INCOTERM_OPTIONS:
            raise ValueError(
                f"Incoterm must be one of: {', '.join(INCOTERM_OPTIONS)}"
            )
        return v

    @model_validator(mode="after")
    def validate_business_details_for_validation_plus(self):
        """Validate that business_model, unit, and unit_price are provided for Validation+ stages."""
        if self.stage in STAGES_REQUIRING_BUSINESS_DETAILS:
            if not self.business_model or not self.business_model.strip():
                raise ValueError("business_model is required for stages: Validation, Proposal, Confirmation, Closed")
            if not self.unit or not self.unit.strip():
                raise ValueError("unit is required for stages: Validation, Proposal, Confirmation, Closed")
            if self.unit_price is None or self.unit_price < 0:
                raise ValueError("unit_price is required and must be >= 0 for stages: Validation, Proposal, Confirmation, Closed")
        return self

    @model_validator(mode="after")
    def validate_close_reason_for_closed(self):
        """Validate that close_reason is provided when stage is Closed."""
        if self.stage == "Closed" and (not self.close_reason or not self.close_reason.strip()):
            raise ValueError("close_reason is required when stage is 'Closed'")
        return self


class SalesPipeline(SalesPipelineBase):
    """Full sales pipeline model with id and timestamps."""
    id: UUID
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    ai_interactions: Optional[List[Dict[str, Any]]] = None
    parent_pipeline_id: Optional[UUID] = None
    version_number: Optional[int] = None
    reason_for_stage_change: Optional[str] = None
    reason_for_amount_change: Optional[str] = None
    is_current_version: Optional[bool] = None


class SalesPipelineListResponse(BaseModel):
    """Response model for listing sales pipelines."""
    pipelines: List[SalesPipeline]
    total: int


# =============================
# PIPELINE INSIGHTS & ANALYTICS
# =============================


class PipelineForecast(BaseModel):
    """Revenue forecast data."""
    forecast_period_days: int
    total_forecast_value: float
    forecast_by_stage: Dict[str, float]
    forecast_by_week: Dict[str, float]
    pipeline_count: int


class PipelineInsights(BaseModel):
    """Pipeline insights and analytics."""
    total_pipeline_value: float
    forecast_value: float
    stage_distribution: Dict[str, int]
    churn_risk_pipelines: List[Dict[str, Any]]
    sample_effectiveness: float
    product_demand: Dict[str, int]
    insights_summary: str

