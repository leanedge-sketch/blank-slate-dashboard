
from fastapi import APIRouter, HTTPException, Depends, Query, Response, UploadFile, File, Form, Request
from fastapi.responses import FileResponse, PlainTextResponse
from fastapi.exceptions import RequestValidationError
from typing import Optional, List
from pathlib import Path
import logging

from app.models.crm import (
    Customer,
    CustomerListResponse,
    CustomerCreate,
    CustomerUpdate,
    Interaction,
    InteractionListResponse,
    InteractionCreate,
    InteractionUpdate,
    CustomerChatRequest,
    QuoteDraftRequest,
    DashboardMetrics,
    CustomerProfileUpdate,
    CustomerProfileFeedback,
    CustomerProfileFeedbackCreate,
)
from app.services.crm_service import (
    get_all_customers,
    get_customer_by_id,
    get_customers_count,
    create_customer,
    update_customer,
    delete_customer,
    build_customer_profile,
    search_customers_by_name,
    get_interactions_for_customer,
    get_interactions_count_for_customer,
    create_interaction,
    get_interaction_by_id,
    update_interaction,
    delete_interaction,
    chat_with_customer,
    generate_quote_excel,
    auto_fill_sales_stage_for_customer,
    get_dashboard_metrics,
    update_customer_profile_text,
    add_customer_profile_feedback,
    list_customer_profile_feedback,
)
from app.dependencies import get_current_user

# Create a router for CRM endpoints
# This groups all CRM-related routes together
router = APIRouter()


# =============================
# CUSTOMER ENDPOINTS
# =============================


@router.get("/customers", response_model=CustomerListResponse)
async def list_customers(
    limit: int = Query(100, ge=1, le=1000, description="Maximum number of customers to return"),
    offset: int = Query(0, ge=0, description="Number of customers to skip (for pagination)"),
    q: Optional[str] = Query(None, description="Optional search query to filter by customer_name"),
    start_date: Optional[str] = Query(None, description="Filter customers with interactions from this date (YYYY-MM-DD)"),
    end_date: Optional[str] = Query(None, description="Filter customers with interactions up to this date (YYYY-MM-DD)"),
    # user: dict = Depends(get_current_user)  # Uncomment when auth is ready
):
    """List customers with optional name search, date filtering, and pagination support.

    - If `q` is provided → returns customers whose `customer_name` contains `q`.
    - If `start_date` or `end_date` is provided → only returns customers that have interactions in that date range.
    - If `q` is empty → returns all customers (paginated).
    """
    try:
        if q:
            # Simple search mode – ignore pagination for now and just cap by limit
            customers = search_customers_by_name(q, limit=limit)
            total = len(customers)
        else:
            customers = get_all_customers(limit=limit, offset=offset, start_date=start_date, end_date=end_date)
            # If date filters are applied, we need to count filtered customers
            if start_date or end_date:
                # Get all filtered customers (without pagination) to count
                all_filtered = get_all_customers(limit=10000, offset=0, start_date=start_date, end_date=end_date)
                total = len(all_filtered)
            else:
                total = get_customers_count()  # crm-selam

        return CustomerListResponse(customers=customers, total=total)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching customers: {str(e)}")


# =============================
# QUOTE TEMPLATES (Excel)
# =============================


@router.get("/quotes/templates/{format_name}")
async def get_quote_template(format_name: str):
    """
    Serve the base Excel template for a given quotation format.

    This lets the frontend open/download the correct .xlsx file in a new tab
    after generating a draft.

    Supported values (case-insensitive today):
    - Baracoda
    - Betchem
    """
    normalized = format_name.lower()
    if normalized == "baracoda":
        filename = "Baracoda.xlsx"
    elif normalized == "betchem":
        filename = "Betchem.xlsx"
    else:
        raise HTTPException(status_code=404, detail="Unknown quote format")

    # Project root: backend/app/api/v1/crm.py → parents:
    # [0]=v1, [1]=api, [2]=app, [3]=backend, [4]=project root
    project_root = Path(__file__).resolve().parents[4]
    template_path = project_root / "qoute_format" / filename

    if not template_path.exists():
        raise HTTPException(status_code=404, detail="Template file not found on server")

    return FileResponse(
        path=template_path,
        filename=filename,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    )


@router.post("/quotes/generate")
async def generate_quote_endpoint(body: QuoteDraftRequest):
    """
    Generate an AI-enhanced quotation Excel file and return it as a download.

    The file is based on the selected template (Baracoda/Betchem) and includes:
    - A 'LeanChem Draft' sheet with all key fields
    - An AI-generated commercial summary paragraph
    """
    try:
        tmp_path = generate_quote_excel(body)
        file_path = Path(tmp_path)
        if not file_path.exists():
            raise HTTPException(status_code=500, detail="Failed to generate quote file")

        filename = f"{body.customer_name or 'quotation'}_{body.format}.xlsx"
        return FileResponse(
            path=file_path,
            filename=filename,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error generating quote: {str(e)}")


@router.get("/customers/{customer_id}", response_model=Customer)
async def get_customer(
    customer_id: str,
    # user: dict = Depends(get_current_user)  # Uncomment when auth is ready
):
    """Get a single customer by UUID."""
    customer = get_customer_by_id(customer_id)

    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")

    return customer


@router.post("/customers", response_model=Customer, status_code=201)
async def create_customer_endpoint(
    customer_in: CustomerCreate,
    # user: dict = Depends(get_current_user)  # Uncomment when auth is ready
):
    """Create a new customer.

    If `display_id` is not provided, the backend will auto-generate one.
    Note: This only creates the basic customer record. Use the "Build Profile" endpoint
    to generate the AI profile with Strategic-Fit Matrix.
    """
    try:
        return create_customer(customer_in)
    except ValueError as e:
        raise HTTPException(status_code=409, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error creating customer: {str(e)}")


@router.post("/customers/{customer_id}/build-profile", response_model=Customer)
async def build_profile_endpoint(
    customer_id: str,
    # user: dict = Depends(get_current_user)  # Uncomment when auth is ready
):
    """
    Build an AI-generated customer profile with Strategic-Fit Matrix.
    
    This endpoint:
    - Fetches product categories from chemical_types table
    - Generates an AI profile with 0-3 ratings for each category
    - Stores the profile as an interaction
    - Updates the customer's product_alignment_scores
    - Logs to RAG conversation table
    
    Call this after creating a customer to get the full profile analysis.
    """
    # Validate customer exists
    customer = get_customer_by_id(customer_id)
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")

    try:
        # Later you can pass the authenticated user_id here
        updated_customer = build_customer_profile(
            customer_id=customer_id,
            user_id=None,
        )
        return updated_customer
    except RuntimeError as e:
        import traceback
        error_detail = f"{str(e)}\n\nTraceback:\n{traceback.format_exc()}"
        raise HTTPException(status_code=500, detail=error_detail)
    except Exception as e:
        import traceback
        error_detail = f"Error building profile: {str(e)}\n\nTraceback:\n{traceback.format_exc()}"
        raise HTTPException(status_code=500, detail=error_detail)


@router.post("/customers/{customer_id}/auto-fill-sales-stage", response_model=Customer)
async def auto_fill_sales_stage_endpoint(
    customer_id: str,
    # user: dict = Depends(get_current_user)  # Uncomment when auth is ready
):
    """
    Auto-fill sales stage for a single customer based on their interaction history.
    Only works if the customer doesn't already have a sales stage set.
    """
    try:
        new_stage = auto_fill_sales_stage_for_customer(customer_id)
        if new_stage is None:
            raise HTTPException(status_code=404, detail="Customer not found or could not determine stage")
        
        # Return updated customer
        customer = get_customer_by_id(customer_id)
        if not customer:
            raise HTTPException(status_code=404, detail="Customer not found")
        return customer
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error auto-filling sales stage: {str(e)}")


@router.put("/customers/{customer_id}/profile", response_model=Customer)
async def update_customer_profile_endpoint(
    customer_id: str,
    profile_update: CustomerProfileUpdate,
    # user: dict = Depends(get_current_user)  # Uncomment when auth is ready
):
    """
    Update the latest AI-generated ICP profile text for a customer.

    This updates the `latest_profile_text` and `latest_profile_updated_at` fields
    on the customer record.
    """
    try:
        return update_customer_profile_text(customer_id, profile_update)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error updating customer profile: {str(e)}")


@router.get(
    "/customers/{customer_id}/profile/feedback",
    response_model=List[CustomerProfileFeedback],
)
async def list_customer_profile_feedback_endpoint(
    customer_id: str,
    limit: int = Query(10, ge=1, le=100, description="Maximum number of feedback entries to return"),
    # user: dict = Depends(get_current_user)  # Uncomment when auth is ready
):
    """Return recent feedback entries (ratings/comments) for a customer's ICP profile.
    
    If the feedback table doesn't exist, returns an empty list (graceful degradation).
    """
    try:
        return list_customer_profile_feedback(customer_id, limit=limit)
    except Exception as e:
        # If table doesn't exist, return empty list instead of 500 error
        error_msg = str(e)
        if "PGRST205" in error_msg or "customer_profile_feedback" in error_msg.lower() or "table" in error_msg.lower():
            import logging
            logging.warning(f"Feedback table not found, returning empty list. Error: {error_msg}")
            return []
        # Re-raise other unexpected errors
        raise HTTPException(status_code=500, detail=f"Error fetching profile feedback: {str(e)}")


@router.post(
    "/customers/{customer_id}/profile/feedback",
    response_model=CustomerProfileFeedback,
    status_code=201,
)
async def add_customer_profile_feedback_endpoint(
    customer_id: str,
    feedback_in: CustomerProfileFeedbackCreate,
    # user: dict = Depends(get_current_user)  # Uncomment when auth is ready
):
    """Submit a rating/comment for a customer's ICP profile.
    
    If the feedback table doesn't exist, returns a mock response (graceful degradation).
    """
    try:
        return add_customer_profile_feedback(customer_id, feedback_in)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        # If table doesn't exist, the service layer should return a mock response
        # But if it still raises, catch it here too
        error_msg = str(e)
        if "PGRST205" in error_msg or "customer_profile_feedback" in error_msg.lower() or "table" in error_msg.lower():
            import logging
            logging.warning(f"Feedback table not found, returning mock response. Error: {error_msg}")
            # Return a mock response so frontend doesn't break
            from uuid import uuid4
            from datetime import datetime
            from app.models.crm import CustomerProfileFeedback
            return CustomerProfileFeedback(
                id=str(uuid4()),
                customer_id=customer_id,
                rating=feedback_in.rating,
                comment=feedback_in.comment,
                user_id=None,
                created_at=datetime.utcnow().isoformat(),
            )
        # Re-raise other unexpected errors
        raise HTTPException(status_code=500, detail=f"Error submitting profile feedback: {str(e)}")


@router.get("/customers/{customer_id}/profile/download", response_class=PlainTextResponse)
async def download_customer_profile_endpoint(
    customer_id: str,
    # user: dict = Depends(get_current_user)  # Uncomment when auth is ready
):
    """
    Download the customer's latest ICP profile text as a plain text file.

    Frontend can call this endpoint and trigger a .txt download.
    """
    customer = get_customer_by_id(customer_id)
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")

    profile_text = customer.latest_profile_text or ""
    if not profile_text.strip():
        profile_text = f"No ICP profile available yet for customer: {customer.customer_name}"

    return PlainTextResponse(
        content=profile_text,
        headers={
            "Content-Disposition": f'attachment; filename="customer_{customer_id}_profile.txt"'
        },
    )


@router.put("/customers/{customer_id}", response_model=Customer)
async def update_customer_endpoint(
    customer_id: str,
    customer_update: CustomerUpdate,
    # user: dict = Depends(get_current_user)  # Uncomment when auth is ready
):
    """Update an existing customer."""
    try:
        return update_customer(customer_id, customer_update)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error updating customer: {str(e)}")


@router.delete("/customers/{customer_id}", status_code=204)
async def delete_customer_endpoint(
    customer_id: str,
    # user: dict = Depends(get_current_user)  # Uncomment when auth is ready
):
    """Delete a customer and all associated interactions."""
    try:
        delete_customer(customer_id)
        return Response(status_code=204)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error deleting customer: {str(e)}")


# =============================
# INTERACTION ENDPOINTS
# =============================


@router.get(
    "/customers/{customer_id}/interactions",
    response_model=InteractionListResponse,
)
async def list_customer_interactions(
    customer_id: str,
    limit: int = Query(100, ge=1, le=1000, description="Maximum number of interactions to return"),
    offset: int = Query(0, ge=0, description="Number of interactions to skip"),
    start_date: Optional[str] = Query(None, description="Filter interactions from this date (YYYY-MM-DD)"),
    end_date: Optional[str] = Query(None, description="Filter interactions up to this date (YYYY-MM-DD)"),
    # user: dict = Depends(get_current_user)  # Uncomment when auth is ready
):
    """List interactions for a specific customer with optional date filtering."""
    # Ensure the customer exists (nice error instead of silent empty list)
    customer = get_customer_by_id(customer_id)
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")

    try:
        interactions = get_interactions_for_customer(
            customer_id,
            limit=limit,
            offset=offset,
            start_date=start_date,
            end_date=end_date,
        )
        total = get_interactions_count_for_customer(
            customer_id,
            start_date=start_date,
            end_date=end_date,
        )
        return InteractionListResponse(interactions=interactions, total=total)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching interactions: {str(e)}")


@router.post(
    "/customers/{customer_id}/interactions",
    response_model=Interaction,
    status_code=201,
)
async def create_customer_interaction(
    customer_id: str,
    interaction_in: InteractionCreate,
    # user: dict = Depends(get_current_user)  # Uncomment when auth is ready
):
    """Create a new interaction for a given customer."""
    # Validate customer exists
    customer = get_customer_by_id(customer_id)
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")

    try:
        # Later you can pass user_id from the authenticated user
        interaction = create_interaction(customer_id, interaction_in)
        return interaction
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error creating interaction: {str(e)}")


@router.put("/interactions/{interaction_id}", response_model=Interaction)
async def update_customer_interaction(
    interaction_id: str,
    interaction_in: InteractionUpdate,
    # user: dict = Depends(get_current_user)  # Uncomment when auth is ready
):
    """Update an existing interaction."""
    existing = get_interaction_by_id(interaction_id)
    if not existing:
        raise HTTPException(status_code=404, detail="Interaction not found")

    try:
        updated = update_interaction(interaction_id, interaction_in)
        if not updated:
            raise HTTPException(status_code=500, detail="Failed to update interaction")
        return updated
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error updating interaction: {str(e)}")


@router.delete("/interactions/{interaction_id}", status_code=204)
async def delete_customer_interaction(
    interaction_id: str,
    # user: dict = Depends(get_current_user)  # Uncomment when auth is ready
):
    """Delete an interaction by ID."""
    existing = get_interaction_by_id(interaction_id)
    if not existing:
        raise HTTPException(status_code=404, detail="Interaction not found")

    try:
        delete_interaction(interaction_id)
        return Response(status_code=204)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error deleting interaction: {str(e)}")


@router.post(
    "/customers/{customer_id}/chat",
    response_model=Interaction,
    status_code=201,
)
async def chat_with_customer_endpoint(
    request: Request,
    customer_id: str,
    input_text: Optional[str] = Form(None),
    tds_id: Optional[str] = Form(None),
    file: Optional[UploadFile] = File(None),
    # user: dict = Depends(get_current_user)  # Uncomment when auth is ready
):
    """
    Run one AI chat turn for a given customer with optional file upload.

    - Accepts JSON (application/json) or FormData (multipart/form-data)
    - Accepts file uploads (PDF, Word, Excel, etc.) via FormData only
    - Uploads file to Supabase storage bucket "attached_FILES"
    - Extracts text from the file
    - Includes file content in AI analysis
    - Stores the turn in `interactions` with file_url
    - Logs a combined Q/A entry in `conversation` (RAG) with embedding
    """
    logger = logging.getLogger(__name__)
    
    from app.services.file_service import upload_file_to_supabase, extract_text_from_file
    
    # Handle both JSON and FormData requests
    content_type = request.headers.get("content-type", "").lower()
    
    # If JSON request, parse from body
    if "application/json" in content_type:
        try:
            body = await request.json()
            input_text = body.get("input_text") or input_text
            tds_id = body.get("tds_id") or tds_id
            # Note: Can't send files via JSON, so file will remain None
        except Exception as e:
            logger.error(f"Error parsing JSON body: {e}")
            raise HTTPException(status_code=400, detail=f"Invalid JSON body: {str(e)}")
    
    # Validate input
    if not input_text or not input_text.strip():
        raise HTTPException(status_code=400, detail="input_text cannot be empty")
    
    # Log received data for debugging
    logger.info(f"Chat endpoint called for customer {customer_id}")
    logger.info(f"Content-Type: {content_type}")
    logger.info(f"Received input_text: {input_text[:100] if input_text else 'None'}")
    logger.info(f"Received tds_id: {tds_id}")
    logger.info(f"Received file: {file.filename if file else 'None'}")
    
    # Validate customer exists
    customer = get_customer_by_id(customer_id)
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")

    file_url = None
    file_type = None
    file_content = None

    # Handle file upload if provided
    if file:
        try:
            # Read file content
            file_bytes = await file.read()
            
            # Check file size (10MB limit)
            max_size = 10 * 1024 * 1024  # 10MB
            if len(file_bytes) > max_size:
                raise HTTPException(status_code=400, detail=f"File too large. Maximum size is {max_size / 1024 / 1024}MB")
            
            # Upload to Supabase storage
            file_url, file_type = upload_file_to_supabase(
                file_bytes,
                file.filename or "uploaded_file",
                bucket_name="attached_FILES"
            )
            
            # Extract text from file
            file_content = extract_text_from_file(file_bytes, file.filename or "uploaded_file", file_type)
        
        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Error processing file: {str(e)}")

    try:
        # Later you can pass the authenticated user_id here
        interaction = chat_with_customer(
            customer_id=customer_id,
            input_text=input_text,
            tds_id=tds_id,
            user_id=None,
            file_url=file_url,
            file_type=file_type,
            file_content=file_content,
        )
        return interaction
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error during AI chat: {str(e)}")


# =============================
# DASHBOARD ENDPOINTS
# =============================

@router.get("/dashboard/metrics", response_model=DashboardMetrics)
async def get_dashboard_metrics_endpoint(
    start_date: Optional[str] = Query(None, description="Filter metrics from this date (YYYY-MM-DD)"),
    end_date: Optional[str] = Query(None, description="Filter metrics up to this date (YYYY-MM-DD)"),
    # user: dict = Depends(get_current_user)  # Uncomment when auth is ready
):
    """
    Get dashboard metrics including customer counts, interaction counts, and sales stage distribution.
    Supports optional date filtering for interactions.
    """
    try:
        return get_dashboard_metrics(start_date=start_date, end_date=end_date)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching dashboard metrics: {str(e)}")


