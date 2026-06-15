"""
Sales Pipeline API Routes
=========================

HTTP endpoints for Sales Pipeline functionality:
- GET  /sales-pipeline                    → list pipelines with filters
- GET  /sales-pipeline/{pipeline_id}       → get single pipeline
- POST /sales-pipeline                    → create new pipeline
- PUT  /sales-pipeline/{pipeline_id}      → update pipeline
- DELETE /sales-pipeline/{pipeline_id}    → delete pipeline
- POST /sales-pipeline/{pipeline_id}/advance-stage → manual stage advance
- POST /sales-pipeline/auto-detect       → AI detect stage from interaction
- GET  /sales-pipeline/forecast          → revenue forecasting
- GET  /sales-pipeline/insights          → pipeline analytics
"""

from typing import Optional, List
from fastapi import APIRouter, HTTPException, Query, Body
from pydantic import BaseModel

from app.models.sales_pipeline import (
    SalesPipeline,
    SalesPipelineCreate,
    SalesPipelineUpdate,
    SalesPipelineListResponse,
    PipelineForecast,
    PipelineInsights,
    CURRENCIES,
    PIPELINE_STAGES,
)
from app.services.pipeline_crm_sync import get_interactions_for_pipeline
from app.services.sales_pipeline_service import (
    list_sales_pipelines,
    count_sales_pipelines,
    get_sales_pipeline_by_id,
    create_sales_pipeline,
    update_sales_pipeline,
    delete_sales_pipeline,
    advance_pipeline_stage,
    detect_pipeline_stage_from_interaction,
    auto_advance_pipeline_stage,
    generate_pipeline_insights,
    get_pipeline_forecast,
    chat_with_pipeline,
    get_pipeline_versions,
)
from app.dependencies import get_current_user

router = APIRouter()


# Request models
class PipelineChatRequest(BaseModel):
    input_text: str


def get_business_models() -> List[str]:
    """Fetch business model names from Business_Model table."""
    from app.services.business_model_service import list_sales_pipeline_business_models

    return list_sales_pipeline_business_models()


# =============================
# UTILITY ENDPOINTS (Must come before /{pipeline_id} route)
# =============================

@router.get("/sales-pipeline/business-models")
async def get_business_models_endpoint():
    """Get list of business models from Business_Model table."""
    import logging
    logger = logging.getLogger(__name__)
    try:
        models = get_business_models()
        logger.info(f"Returning {len(models)} business models")
        return {"business_models": models}
    except Exception as e:
        # Log the error but return empty list instead of raising exception
        # This allows the frontend to still work even if table doesn't exist yet
        logger.error(f"Error fetching business models: {str(e)}", exc_info=True)
        return {"business_models": []}


@router.get("/sales-pipeline/currencies")
async def get_currencies_endpoint():
    """Get list of supported currencies."""
    try:
        return {"currencies": CURRENCIES}
    except Exception as e:
        import logging
        logger = logging.getLogger(__name__)
        logger.error(f"Error getting currencies: {e}")
        # Fallback to hardcoded list
        return {"currencies": ["ETB", "KES", "USD", "EUR"]}


@router.get("/sales-pipeline/stages")
async def get_stages_endpoint():
    """Get list of pipeline stages."""
    return {"stages": PIPELINE_STAGES}


@router.get("/sales-pipeline/forecast", response_model=PipelineForecast)
async def get_forecast(
    days_ahead: int = Query(30, ge=1, le=365, description="Number of days to forecast"),
    customer_id: Optional[str] = Query(None, description="Filter by customer ID"),
    # user: dict = Depends(get_current_user)
):
    """Generate revenue forecast for the next N days based on pipeline data."""
    try:
        return get_pipeline_forecast(
            days_ahead=days_ahead,
            customer_id=customer_id,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error generating forecast: {str(e)}")


@router.get("/sales-pipeline/insights", response_model=PipelineInsights)
async def get_insights(
    customer_id: Optional[str] = Query(None, description="Filter by customer ID"),
    tds_id: Optional[str] = Query(None, description="Filter by product/TDS ID"),
    days_back: int = Query(90, ge=1, le=365, description="Number of days to analyze"),
    # user: dict = Depends(get_current_user)
):
    """Generate AI-powered insights and analytics for the sales pipeline."""
    try:
        return generate_pipeline_insights(
            customer_id=customer_id,
            tds_id=tds_id,
            days_back=days_back,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error generating insights: {str(e)}")


# =============================
# CRUD ENDPOINTS
# =============================


@router.get("/sales-pipeline", response_model=SalesPipelineListResponse)
async def list_pipelines(
    limit: int = Query(100, ge=1, le=1000, description="Maximum number of pipelines to return"),
    offset: int = Query(0, ge=0, description="Number of pipelines to skip (for pagination)"),
    customer_id: Optional[str] = Query(None, description="Filter by customer ID"),
    tds_id: Optional[str] = Query(None, description="Filter by TDS/product ID"),
    chemical_type_id: Optional[str] = Query(None, description="Filter by chemical type ID"),
    stage: Optional[str] = Query(None, description="Filter by pipeline stage"),
    latest_per_deal: bool = Query(
        True,
        description="Return one current/latest pipeline per customer+product",
    ),
    # user: dict = Depends(get_current_user)  # Uncomment when auth is ready
):
    """List sales pipeline records with optional filters and pagination."""
    try:
        pipelines = list_sales_pipelines(
            limit=limit,
            offset=offset,
            customer_id=customer_id,
            tds_id=tds_id,
            chemical_type_id=chemical_type_id,
            stage=stage,
            latest_per_deal=latest_per_deal,
        )
        total = count_sales_pipelines(
            customer_id=customer_id,
            tds_id=tds_id,
            chemical_type_id=chemical_type_id,
            stage=stage,
            latest_per_deal=latest_per_deal,
        )
        return SalesPipelineListResponse(pipelines=pipelines, total=total)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching pipelines: {str(e)}")


@router.get("/sales-pipeline/{pipeline_id}", response_model=SalesPipeline)
async def get_pipeline(
    pipeline_id: str,
    # user: dict = Depends(get_current_user)
):
    """Get a single sales pipeline record by ID."""
    try:
        pipeline = get_sales_pipeline_by_id(pipeline_id)
        if not pipeline:
            raise HTTPException(status_code=404, detail="Sales pipeline record not found")
        return pipeline
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching pipeline: {str(e)}")


@router.get("/sales-pipeline/{pipeline_id}/interactions")
async def list_pipeline_interactions_endpoint(
    pipeline_id: str,
    limit: int = Query(100, ge=1, le=500),
):
    """CRM interactions linked to this pipeline (and matching customer + TDS)."""
    pipeline = get_sales_pipeline_by_id(pipeline_id)
    if not pipeline:
        raise HTTPException(status_code=404, detail="Sales pipeline record not found")
    try:
        rows = get_interactions_for_pipeline(pipeline_id, limit=limit)
        return {"interactions": rows, "total": len(rows)}
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error fetching pipeline interactions: {str(e)}",
        )


@router.get("/sales-pipeline/{pipeline_id}/versions", response_model=SalesPipelineListResponse)
async def get_pipeline_versions_endpoint(
    pipeline_id: str,
    # user: dict = Depends(get_current_user)
):
    """Get all versions of a pipeline (history with change reasons)."""
    try:
        versions = get_pipeline_versions(pipeline_id)
        return SalesPipelineListResponse(pipelines=versions, total=len(versions))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching pipeline versions: {str(e)}")


def _pipeline_error_detail(exc: Exception) -> str:
    msg = str(exc)
    if "sales_pipeline_business_model_check" in msg:
        return (
            "Business model is not allowed by the database yet. "
            "Run docs/0012_sales_pipeline_business_model.sql in Supabase SQL Editor "
            "(or scripts/apply_sales_pipeline_business_model_migration.py), then retry."
        )
    return msg


@router.post("/sales-pipeline", response_model=SalesPipeline, status_code=201)
async def create_pipeline(
    body: SalesPipelineCreate,
    # user: dict = Depends(get_current_user)
):
    """Create a new sales pipeline record."""
    try:
        return create_sales_pipeline(body)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error creating pipeline: {_pipeline_error_detail(e)}")


@router.put("/sales-pipeline/{pipeline_id}", response_model=SalesPipeline)
async def update_pipeline(
    pipeline_id: str,
    body: SalesPipelineUpdate,
    # user: dict = Depends(get_current_user)
):
    """Update an existing sales pipeline record."""
    try:
        return update_sales_pipeline(pipeline_id, body)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error updating pipeline: {_pipeline_error_detail(e)}")


@router.delete("/sales-pipeline/{pipeline_id}", status_code=204)
async def delete_pipeline(
    pipeline_id: str,
    # user: dict = Depends(get_current_user)
):
    """Delete a sales pipeline record."""
    try:
        delete_sales_pipeline(pipeline_id)
        return None
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error deleting pipeline: {str(e)}")


# =============================
# STAGE MANAGEMENT ENDPOINTS
# =============================


@router.post("/sales-pipeline/{pipeline_id}/advance-stage", response_model=SalesPipeline)
async def advance_stage(
    pipeline_id: str,
    new_stage: str = Body(..., description="New stage to move to"),
    metadata_updates: Optional[dict] = Body(None, description="Optional metadata updates"),
    # user: dict = Depends(get_current_user)
):
    """Manually advance or update the stage of a pipeline record."""
    try:
        return advance_pipeline_stage(
            pipeline_id=pipeline_id,
            new_stage=new_stage,
            metadata_updates=metadata_updates,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error advancing stage: {str(e)}")


# =============================
# AI ENDPOINTS
# =============================


@router.post("/sales-pipeline/auto-detect")
async def auto_detect_stage(
    interaction_text: str = Body(..., description="Customer interaction text to analyze"),
    current_stage: Optional[str] = Body(None, description="Current pipeline stage (if exists)"),
    customer_name: Optional[str] = Body(None, description="Customer name for context"),
    product_name: Optional[str] = Body(None, description="Product name for context"),
    # user: dict = Depends(get_current_user)
):
    """Use AI to detect the appropriate pipeline stage from interaction text."""
    try:
        result = detect_pipeline_stage_from_interaction(
            interaction_text=interaction_text,
            current_stage=current_stage,
            customer_name=customer_name,
            product_name=product_name,
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error detecting stage: {str(e)}")


@router.post("/sales-pipeline/{pipeline_id}/auto-advance", response_model=SalesPipeline)
async def auto_advance_from_interaction(
    pipeline_id: str,
    interaction_text: str = Body(..., description="Customer interaction text to analyze"),
    customer_name: Optional[str] = Body(None, description="Customer name for context"),
    product_name: Optional[str] = Body(None, description="Product name for context"),
    # user: dict = Depends(get_current_user)
):
    """Automatically advance pipeline stage based on AI analysis of interaction text."""
    try:
        return auto_advance_pipeline_stage(
            pipeline_id=pipeline_id,
            interaction_text=interaction_text,
            customer_name=customer_name,
            product_name=product_name,
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error auto-advancing stage: {str(e)}")


@router.post("/sales-pipeline/{pipeline_id}/chat")
async def chat_with_pipeline_endpoint(
    pipeline_id: str,
    body: PipelineChatRequest,
    # user: dict = Depends(get_current_user)
):
    """
    Get AI-powered sales advice for a specific pipeline.
    
    This endpoint provides product-specific, customer-specific, and stage-specific
    advice without needing to navigate to the customer profile.
    
    The AI has access to:
    - Pipeline details (stage, deal value, expected close date)
    - Customer information
    - Product/TDS specifications
    - Related pipeline history
    - Product-specific customer interactions
    
    Returns AI response along with pipeline, customer, and product context.
    """
    try:
        result = chat_with_pipeline(
            pipeline_id=pipeline_id,
            input_text=body.input_text,
            user_id=None,  # TODO: Get from authenticated user
        )
        return result
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error during AI chat: {str(e)}")

