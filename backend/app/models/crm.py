"""
CRM Data Models (Pydantic Schemas)

These define the \"shape\" of data that your API accepts and returns.
Think of them as \"contracts\" - they tell FastAPI what to expect.

Example:
- When someone calls GET /customers, they get back a list of Customer objects
- When someone calls POST /customers, they send a CustomerCreate object
"""
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from datetime import datetime
from uuid import UUID


# =============================
# CUSTOMER MODELS
# =============================


class CustomerBase(BaseModel):
    """Base customer model with common fields"""
    customer_name: str
    display_id: Optional[str] = None
    website_url: Optional[str] = None
    linkedin_company_url: Optional[str] = None
    primary_contact_name: Optional[str] = None
    primary_contact_email: Optional[str] = None
    primary_contact_phone: Optional[str] = None


class CustomerCreate(CustomerBase):
    """Model for creating a new customer"""
    pass


class CustomerUpdate(BaseModel):
    """Model for updating a customer (partial update)"""
    customer_name: Optional[str] = None
    display_id: Optional[str] = None
    sales_stage: Optional[str] = None  # Sales stage (1-7)
    website_url: Optional[str] = None
    linkedin_company_url: Optional[str] = None
    primary_contact_name: Optional[str] = None
    primary_contact_email: Optional[str] = None
    primary_contact_phone: Optional[str] = None


class Customer(CustomerBase):
    """Model for customer response (includes ID and timestamps)"""
    customer_id: UUID
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    sales_stage: Optional[str] = None  # Current sales stage (1-7 from Brian Tracy process)
    latest_profile_text: Optional[str] = None
    latest_profile_updated_at: Optional[datetime] = None
    latest_profile_research_meta: Optional[Dict[str, Any]] = None
    external_last_fetched_at: Optional[datetime] = None

    class Config:
        from_attributes = True  # Allows conversion from SQLAlchemy/ORM objects


class CustomerListResponse(BaseModel):
    """Response model for listing customers"""
    customers: List[Customer]
    total: int


# =============================
# INTERACTION MODELS
# =============================


class InteractionBase(BaseModel):
    """Base model for an interaction between customer and AI/user"""
    input_text: Optional[str] = None
    ai_response: Optional[str] = None
    file_url: Optional[str] = None
    file_type: Optional[str] = None
    tds_id: Optional[UUID] = None
    pipeline_id: Optional[UUID] = None


class InteractionCreate(InteractionBase):
    """Payload used when creating a new interaction"""
    # At minimum we usually expect some input_text, but keep it optional
    # to stay flexible while you iterate.
    pass


class InteractionUpdate(BaseModel):
    """Payload for updating an existing interaction (partial update)"""
    input_text: Optional[str] = None
    ai_response: Optional[str] = None
    file_url: Optional[str] = None
    file_type: Optional[str] = None
    tds_id: Optional[UUID] = None
    pipeline_id: Optional[UUID] = None


class Interaction(InteractionBase):
    """Interaction response model (includes IDs and timestamps)"""
    id: UUID
    customer_id: UUID
    user_id: Optional[UUID] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    # Present on merged history rows sourced from sales_pipeline.ai_interactions
    history_source: Optional[str] = None


class InteractionListResponse(BaseModel):
    """Response model for listing interactions for a customer"""
    interactions: List[Interaction]
    total: int
    interactions_table_total: Optional[int] = None
    conversation_total: Optional[int] = None
    pipeline_total: Optional[int] = None
    chatgpt_export_total: Optional[int] = None
    conversation_logs: Optional[List[Dict[str, Any]]] = None


class InteractionSourceAudit(BaseModel):
    """Diagnostic: where CRM history lives in Supabase for one customer."""
    customer_id: str
    interactions_table: str
    conversation_table: str
    pipeline_table: Optional[str] = None
    interactions_total: int
    conversation_total: int
    pipeline_total: Optional[int] = 0
    merged_total: Optional[int] = 0
    interactions_by_month: Dict[str, int]
    conversation_by_month: Dict[str, int]
    pipeline_by_month: Optional[Dict[str, int]] = None
    may_interactions: int
    may_conversation: int
    may_pipeline: Optional[int] = 0
    may_merged: Optional[int] = 0
    merged_table_rows: Optional[int] = 0
    merged_conversation_only: Optional[int] = 0
    merged_pipeline_only: Optional[int] = 0


class CustomerChatRequest(BaseModel):
    """Request body for AI chat with a customer."""
    input_text: str
    tds_id: Optional[UUID] = None
    pipeline_id: Optional[UUID] = None
    file_url: Optional[str] = None  # URL of uploaded file in Supabase storage
    file_type: Optional[str] = None  # MIME type of the file
    file_content: Optional[str] = None  # Extracted text content from the file


class CRMDashboardSummary(BaseModel):
    """High-level CRM metrics for the dashboard."""

    total_customers: int
    total_interactions: int
    customers_with_interactions: int


class CRMQuestion(BaseModel):
    """Natural-language analytics question about the whole CRM."""

    question: str


class CRMAnswer(BaseModel):
    """AI-generated answer for a CRM analytics question."""

    answer: str


# =============================
# QUOTE DRAFT MODELS
# =============================


class QuoteProductLine(BaseModel):
    """Single product line in a quotation draft."""

    chemical_type_name: str
    quantity: float
    unit: str
    target_price: Optional[str] = None
    notes: Optional[str] = None


class QuoteDraftRequest(BaseModel):
    """Payload sent from frontend to generate an AI-enhanced Excel quote."""

    format: str  # "Baracoda" or "Betchem"
    customer_name: str
    reference: Optional[str] = None
    validity: Optional[str] = None
    payment_terms: Optional[str] = None
    delivery_terms: Optional[str] = None
    incoterms: Optional[str] = None
    notes: Optional[str] = None
    terms_and_conditions: Optional[str] = None
    products: List[QuoteProductLine]
    linked_customer_id: Optional[UUID] = None


# =============================
# DASHBOARD MODELS
# =============================

class QuietCustomerSummary(BaseModel):
    """Customer with no interactions in the selected date range."""
    customer_id: UUID
    customer_name: str
    display_id: Optional[str] = None


class WeeklyInteractionCount(BaseModel):
    """Interaction count grouped by ISO week (Monday start)."""
    week_start: str  # YYYY-MM-DD
    count: int


class DashboardMetrics(BaseModel):
    """Dashboard metrics response"""
    total_customers: int
    total_interactions: int
    customers_with_interactions: int
    sales_stages_distribution: Dict[str, int]  # {"1": 5, "2": 3, ...}
    quiet_customers: List[QuietCustomerSummary] = []
    interactions_by_week: List[WeeklyInteractionCount] = []


class CustomerProfileUpdate(BaseModel):
    """Payload to update the AI-generated ICP profile text for a customer."""

    profile_text: str


class CustomerProfileFeedbackCreate(BaseModel):
    """Payload for submitting a rating/comment on a customer's ICP profile."""

    rating: int  # 1-5
    comment: Optional[str] = None


class CustomerProfileFeedback(BaseModel):
    """Feedback entry returned to the frontend."""

    id: UUID
    customer_id: UUID
    rating: int
    comment: Optional[str] = None
    user_id: Optional[UUID] = None
    created_at: Optional[datetime] = None


