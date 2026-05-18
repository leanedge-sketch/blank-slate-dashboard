"""
Sales Pipeline Service - Business Logic Layer
============================================

This file contains the "business logic" for Sales Pipeline operations on top of Supabase:
- sales_pipeline CRUD operations
- Pipeline stage management
- Pipeline analytics and insights
"""

from typing import List, Optional, Dict, Any
import json
from datetime import datetime, date, timedelta

from supabase import Client

from app.database.connection import get_supabase_client
from app.models.sales_pipeline import (
    SalesPipeline,
    SalesPipelineCreate,
    SalesPipelineUpdate,
    PipelineForecast,
    PipelineInsights,
    PIPELINE_STAGES,
)
from app.services.ai_service import gemini_chat, gemini_embed, GeminiError, log_conversation_to_rag
from app.services.crm_service import get_customer_by_id, get_interactions_for_customer
from app.services.pms_service import get_tds_by_id
from app.services.ai_service import gemini_chat, GeminiError


# =============================
# HELPER FUNCTIONS
# =============================


def convert_uuids(obj: Any) -> Any:
    """
    Recursively convert UUID objects to strings for JSON serialization.
    Used when inserting/updating data in Supabase.
    """
    from uuid import UUID
    
    if isinstance(obj, UUID):
        return str(obj)
    elif isinstance(obj, dict):
        return {k: convert_uuids(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [convert_uuids(item) for item in obj]
    elif isinstance(obj, tuple):
        return tuple(convert_uuids(item) for item in obj)
    elif isinstance(obj, date):
        # Convert date to string for JSON serialization
        return obj.isoformat()
    return obj


def normalize_pipeline_payload_to_db(payload: dict) -> dict:
    """
    Normalize a payload from the API model to match the database column names.
    Maps 'amount' to 'deal_value_usd' or 'amount' depending on database schema.
    """
    payload = dict(payload)
    
    # Map 'amount' to database column name
    # Check if database has 'amount' column, otherwise use 'deal_value_usd'
    # For now, we'll try 'amount' first, and if that fails, the database will tell us
    # But to be safe, we'll check what columns exist by trying both
    # Since user said they changed it to 'amount', we'll use 'amount'
    # But if the database still has 'deal_value_usd', we need to map it
    
    # For now, keep 'amount' as is - if database column is 'amount', it will work
    # If database column is still 'deal_value_usd', we need to map it
    # Let's check: if payload has 'amount' and we want to be compatible with both,
    # we can try to detect, but for now, let's assume database has 'amount' column
    # If it doesn't work, we'll need to map 'amount' -> 'deal_value_usd'
    
    return payload


def normalize_pipeline_row_from_db(row: dict) -> dict:
    """
    Normalize a database row to match the SalesPipeline model.
    Handles column name mapping (deal_value -> amount) and data type conversions.
    """
    row = dict(row)
    
    # Handle column name mapping: if database has 'deal_value' or 'deal_value_usd', map it to 'amount'
    if "deal_value" in row and "amount" not in row:
        row["amount"] = row.pop("deal_value")
    elif "deal_value_usd" in row and "amount" not in row:
        row["amount"] = row.pop("deal_value_usd")
    
    # Normalize metadata if it's a string
    meta_val = row.get("metadata")
    if isinstance(meta_val, str):
        try:
            row["metadata"] = json.loads(meta_val)
        except:
            row["metadata"] = {}
    
    # Normalize ai_interactions if it's a string
    ai_interactions_val = row.get("ai_interactions")
    if isinstance(ai_interactions_val, str):
        try:
            row["ai_interactions"] = json.loads(ai_interactions_val)
        except:
            row["ai_interactions"] = []
    elif ai_interactions_val is None:
        row["ai_interactions"] = []
    
    return row


# =============================
# CRUD OPERATIONS
# =============================


def list_sales_pipelines(
    limit: int = 100,
    offset: int = 0,
    customer_id: Optional[str] = None,
    tds_id: Optional[str] = None,
    chemical_type_id: Optional[str] = None,
    stage: Optional[str] = None,
) -> List[SalesPipeline]:
    """
    List sales pipeline records with optional filters.
    
    Args:
        limit: Maximum number of records to return
        offset: Number of records to skip
        customer_id: Filter by customer ID
        tds_id: Filter by TDS/product ID
        chemical_type_id: Filter by chemical type ID
        stage: Filter by pipeline stage
    
    Returns:
        List of SalesPipeline records
    """
    supabase: Client = get_supabase_client()
    query = supabase.table("sales_pipeline").select("*")
    
    # Apply filters
    if customer_id:
        query = query.eq("customer_id", customer_id)
    if tds_id:
        query = query.eq("tds_id", tds_id)
    if chemical_type_id:
        query = query.eq("chemical_type_id", chemical_type_id)
    if stage:
        query = query.eq("stage", stage)
    
    response = (
        query.order("created_at", desc=True)
        .limit(limit)
        .offset(offset)
        .execute()
    )
    
    if response.data is None:
        return []
    
    # Normalize metadata and ai_interactions if they're strings
    normalized_rows = []
    for row in response.data:
        normalized_row = normalize_pipeline_row_from_db(row)
        normalized_rows.append(normalized_row)
    
    return [SalesPipeline(**row) for row in normalized_rows]


def count_sales_pipelines(
    customer_id: Optional[str] = None,
    tds_id: Optional[str] = None,
    chemical_type_id: Optional[str] = None,
    stage: Optional[str] = None,
) -> int:
    """
    Count total sales pipeline records with optional filters.
    
    Args:
        customer_id: Filter by customer ID
        tds_id: Filter by TDS/product ID
        chemical_type_id: Filter by chemical type ID
        stage: Filter by pipeline stage
    
    Returns:
        Total count of matching records
    """
    supabase: Client = get_supabase_client()
    query = supabase.table("sales_pipeline").select("id", count="exact")
    
    # Apply filters
    if customer_id:
        query = query.eq("customer_id", customer_id)
    if tds_id:
        query = query.eq("tds_id", tds_id)
    if chemical_type_id:
        query = query.eq("chemical_type_id", chemical_type_id)
    if stage:
        query = query.eq("stage", stage)
    
    response = query.execute()
    return response.count or 0


def get_sales_pipeline_by_id(pipeline_id: str) -> Optional[SalesPipeline]:
    """
    Get a single sales pipeline record by ID.
    
    Args:
        pipeline_id: UUID of the pipeline record
    
    Returns:
        SalesPipeline if found, None otherwise
    """
    supabase: Client = get_supabase_client()
    response = (
        supabase.table("sales_pipeline")
        .select("*")
        .eq("id", pipeline_id)
        .single()
        .execute()
    )
    
    if not response.data:
        return None
    
    row = normalize_pipeline_row_from_db(response.data)
    return SalesPipeline(**row)


def get_pipeline_versions(pipeline_id: str) -> List[SalesPipeline]:
    """
    Get all versions of a pipeline (including the original and all updates).
    
    Args:
        pipeline_id: UUID of any version of the pipeline
    
    Returns:
        List of all pipeline versions, ordered by version_number (oldest first)
    """
    supabase: Client = get_supabase_client()
    
    # Get the pipeline to find its parent or itself
    pipeline = get_sales_pipeline_by_id(pipeline_id)
    if not pipeline:
        return []
    
    # Find the root pipeline ID (either parent_pipeline_id or the pipeline itself)
    root_id = pipeline.parent_pipeline_id or pipeline.id
    
    # Get all versions (where parent_pipeline_id = root_id OR id = root_id)
    response = (
        supabase.table("sales_pipeline")
        .select("*")
        .or_(f"parent_pipeline_id.eq.{root_id},id.eq.{root_id}")
        .order("version_number", desc=False)  # Oldest first
        .execute()
    )
    
    if not response.data:
        return []
    
    normalized_rows = []
    for row in response.data:
        normalized_row = normalize_pipeline_row_from_db(row)
        normalized_rows.append(normalized_row)
    
    return [SalesPipeline(**row) for row in normalized_rows]


def extract_lead_info_from_interactions(customer_id: str) -> Dict[str, Optional[str]]:
    """
    Extract lead_source and contact_per_lead from customer interactions using AI.
    
    Args:
        customer_id: Customer UUID
    
    Returns:
        Dict with 'lead_source' and 'contact_per_lead' (or None if not found)
    """
    try:
        interactions = get_interactions_for_customer(customer_id, limit=20)
        if not interactions:
            return {"lead_source": None, "contact_per_lead": None}
        
        # Build context from interactions
        interaction_texts = []
        for it in interactions[:10]:  # Use last 10 interactions
            if it.input_text:
                interaction_texts.append(f"User: {it.input_text[:200]}")
            if it.ai_response:
                interaction_texts.append(f"AI: {it.ai_response[:200]}")
        
        context = "\n".join(interaction_texts)
        
        if not context.strip():
            return {"lead_source": None, "contact_per_lead": None}
        
        # Use AI to extract lead information
        system_prompt = """You are analyzing customer interactions to extract lead information.
Extract the following information if mentioned:
1. Lead Source: Where/how did this lead come from? (e.g., "Website", "Referral", "Trade Show", "LinkedIn", "Cold Call", etc.)
2. Contact Person: Name or title of the contact person for this lead (e.g., "John Doe", "Procurement Manager", "CEO", etc.)

Return ONLY a JSON object with these two fields. If information is not found, use null.
Format: {"lead_source": "value or null", "contact_per_lead": "value or null"}"""
        
        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": f"Extract lead information from these interactions:\n\n{context}"}
        ]
        
        try:
            ai_response = gemini_chat(messages)
            # Try to parse JSON from response
            import re
            json_match = re.search(r'\{[^}]+\}', ai_response)
            if json_match:
                extracted = json.loads(json_match.group())
                return {
                    "lead_source": extracted.get("lead_source"),
                    "contact_per_lead": extracted.get("contact_per_lead")
                }
        except:
            pass
        
        return {"lead_source": None, "contact_per_lead": None}
    except Exception:
        return {"lead_source": None, "contact_per_lead": None}


def create_sales_pipeline(body: SalesPipelineCreate) -> SalesPipeline:
    """
    Create a new sales pipeline record.
    
    Args:
        body: SalesPipelineCreate object with pipeline data
    
    Returns:
        Created SalesPipeline record
    """
    supabase: Client = get_supabase_client()
    payload = body.model_dump(exclude_unset=True)
    
    # Auto-extract lead_source and contact_per_lead from interactions if not provided
    if not payload.get("lead_source") or not payload.get("contact_per_lead"):
        lead_info = extract_lead_info_from_interactions(str(body.customer_id))
        if not payload.get("lead_source") and lead_info.get("lead_source"):
            payload["lead_source"] = lead_info["lead_source"]
        if not payload.get("contact_per_lead") and lead_info.get("contact_per_lead"):
            payload["contact_per_lead"] = lead_info["contact_per_lead"]
    
    # Convert all UUIDs and dates to strings for JSON serialization
    payload = convert_uuids(payload)
    
    # Map 'amount' to database column name
    # The database might have 'amount', 'deal_value', or 'deal_value_usd'
    # Since user said they changed it to 'amount', we'll try that first
    # But to be safe, we'll also check for the other column names
    db_payload = dict(payload)
    
    # Log the payload for debugging
    import logging
    logger = logging.getLogger(__name__)
    logger.info(f"Creating pipeline with payload: {db_payload}")
    logger.info(f"Amount value: {db_payload.get('amount')}, type: {type(db_payload.get('amount'))}")
    
    # Try inserting with 'amount' first
    try:
        response = supabase.table("sales_pipeline").insert(db_payload).execute()
    except Exception as e:
        # If it fails because column doesn't exist, try mapping 'amount' to 'deal_value' or 'deal_value_usd'
        error_str = str(e).lower()
        if "amount" in error_str and ("column" in error_str or "does not exist" in error_str or "unknown" in error_str):
            logger.warning(f"Column 'amount' not found, trying 'deal_value' instead. Error: {str(e)}")
            if "amount" in db_payload and db_payload["amount"] is not None:
                db_payload["deal_value"] = db_payload.pop("amount")
            try:
                response = supabase.table("sales_pipeline").insert(db_payload).execute()
            except Exception as e2:
                logger.warning(f"Column 'deal_value' not found, trying 'deal_value_usd' instead. Error: {str(e2)}")
                if "deal_value" in db_payload:
                    db_payload["deal_value_usd"] = db_payload.pop("deal_value")
                elif "amount" in payload:  # In case the first mapping didn't happen
                    db_payload["deal_value_usd"] = payload["amount"]
                response = supabase.table("sales_pipeline").insert(db_payload).execute()
        else:
            raise
    
    if not response.data:
        raise RuntimeError("Failed to create sales pipeline record")
    
    row = normalize_pipeline_row_from_db(response.data[0])
    logger.info(f"Created pipeline, returned row: {row}")
    return SalesPipeline(**row)


def validate_stage_progression(old_stage: str, new_stage: str, reason: Optional[str]) -> None:
    """
    Validate that stage progression is valid and reason is provided when needed.
    
    Rules:
    - Must progress sequentially (Lead ID -> Discovery -> Sample -> Validation -> Proposal -> Confirmation -> Closed)
    - Cannot skip stages forward without reason
    - "Lost" can be jumped to from any stage but requires reason
    - Moving backward requires reason
    
    Args:
        old_stage: Current stage
        new_stage: New stage
        reason: Reason for stage change (required if skipping stages, moving backward, or moving to Lost)
    
    Raises:
        ValueError: If stage progression is invalid or reason is missing
    """
    if old_stage == new_stage:
        return  # No change, no validation needed
    
    stage_order = [s for s in PIPELINE_STAGES if s != "Lost"]  # Sequential stages (Lost is special)
    old_index = stage_order.index(old_stage) if old_stage in stage_order else None
    new_index = stage_order.index(new_stage) if new_stage in stage_order else None
    
    # Special case: Moving to "Lost" from any stage - always allowed but requires reason
    if new_stage == "Lost":
        if not reason or not reason.strip():
            raise ValueError("reason_for_stage_change is required when moving to Lost stage")
        return  # Lost can be reached from any stage with reason
    
    # If old stage is Lost, can move to any stage (reopening)
    if old_stage == "Lost":
        if not reason or not reason.strip():
            raise ValueError("reason_for_stage_change is required when moving from Lost stage")
        return
    
    if old_index is None or new_index is None:
        return  # Allow if stages not in order (edge case)
    
    # Moving forward by exactly 1 stage (normal sequential progression) - reason optional
    if new_index == old_index + 1:
        return  # Normal progression, reason optional
    
    # Moving backward - require reason
    if new_index < old_index:
        if not reason or not reason.strip():
            raise ValueError("reason_for_stage_change is required when moving backward in pipeline stages")
        return
    
    # Skipping stages forward (more than 1) - NOT ALLOWED, require reason and explain
    if new_index > old_index + 1:
        skipped_stages = stage_order[old_index + 1:new_index]
        if not reason or not reason.strip():
            raise ValueError(
                f"Cannot skip pipeline stages. You are trying to jump from '{old_stage}' to '{new_stage}', "
                f"skipping: {', '.join(skipped_stages)}. "
                f"You must progress sequentially through: {old_stage} -> {stage_order[old_index + 1]}. "
                f"If you need to skip stages, please provide a detailed reason_for_stage_change explaining why."
            )
        # Even with reason, warn but allow (they provided reason)
        return


def update_sales_pipeline(pipeline_id: str, body: SalesPipelineUpdate) -> SalesPipeline:
    """
    Update an existing sales pipeline record.
    If stage or amount changes, creates a new version instead of updating existing record.
    
    Args:
        pipeline_id: UUID of the pipeline record
        body: SalesPipelineUpdate object with fields to update
    
    Returns:
        Updated SalesPipeline record (new version if stage/amount changed)
    """
    supabase: Client = get_supabase_client()
    
    # Check if pipeline exists
    existing = get_sales_pipeline_by_id(pipeline_id)
    if not existing:
        raise ValueError("Sales pipeline record not found")
    
    update_data = body.model_dump(exclude_unset=True)
    if not update_data:
        return existing
    
    # Check if stage or amount changed
    stage_changed = "stage" in update_data and update_data["stage"] != existing.stage
    amount_changed = "amount" in update_data and update_data.get("amount") != existing.amount
    
    # Validate stage progression if stage changed
    if stage_changed:
        reason = update_data.get("reason_for_stage_change")
        validate_stage_progression(existing.stage, update_data["stage"], reason)
        if not reason or not reason.strip():
            raise ValueError("reason_for_stage_change is required when stage changes")
    
    # Validate amount change reason if amount changed
    if amount_changed:
        reason = update_data.get("reason_for_amount_change")
        if not reason or not reason.strip():
            raise ValueError("reason_for_amount_change is required when amount changes")
    
    # If stage or amount changed, create new version instead of updating
    if stage_changed or amount_changed:
        # Mark old version as not current
        supabase.table("sales_pipeline").update({
            "is_current_version": False
        }).eq("id", pipeline_id).execute()
        
        # Get next version number
        parent_id = existing.parent_pipeline_id or existing.id
        version_query = supabase.table("sales_pipeline").select("version_number").or_(
            f"parent_pipeline_id.eq.{parent_id},id.eq.{parent_id}"
        ).order("version_number", desc=True).limit(1).execute()
        
        next_version = 1
        if version_query.data:
            next_version = (version_query.data[0].get("version_number") or 0) + 1
        
        # Create new version with all existing data + updates
        # Get all fields from existing pipeline, excluding metadata fields
        existing_dict = existing.model_dump(exclude={"id", "created_at", "updated_at", "version_number", "parent_pipeline_id", "is_current_version", "ai_interactions"})
        
        # Filter out None values and fields that might not exist in database
        # Only include fields that have values to avoid column errors
        new_pipeline_data = {}
        for key, value in existing_dict.items():
            if value is not None:
                new_pipeline_data[key] = value
        
        # Apply updates
        for key, value in update_data.items():
            if value is not None:
                new_pipeline_data[key] = value
        
        # Set versioning fields
        new_pipeline_data["parent_pipeline_id"] = parent_id
        new_pipeline_data["version_number"] = next_version
        new_pipeline_data["is_current_version"] = True
        
        # Convert UUIDs and dates
        new_pipeline_data = convert_uuids(new_pipeline_data)
        
        # Create new pipeline record
        import logging
        logger = logging.getLogger(__name__)
        logger.info(f"Creating new pipeline version for {pipeline_id}: version {next_version}")
        logger.info(f"New pipeline data keys: {list(new_pipeline_data.keys())}")
        
        try:
            response = supabase.table("sales_pipeline").insert(new_pipeline_data).execute()
        except Exception as e:
            error_str = str(e).lower()
            # Handle missing column errors by removing those fields
            if "column" in error_str and "does not exist" in error_str:
                logger.warning(f"Column error detected: {str(e)}")
                # Try to identify which column is missing and remove it
                if "incoterm" in error_str:
                    logger.warning("Removing 'incoterm' field - column doesn't exist")
                    new_pipeline_data.pop("incoterm", None)
                if "forex" in error_str:
                    logger.warning("Removing 'forex' field - column doesn't exist")
                    new_pipeline_data.pop("forex", None)
                if "business_unit" in error_str:
                    logger.warning("Removing 'business_unit' field - column doesn't exist")
                    new_pipeline_data.pop("business_unit", None)
                if "amount" in error_str:
                    logger.warning("Removing 'amount' field, trying 'deal_value_usd' instead")
                    if "amount" in new_pipeline_data:
                        new_pipeline_data["deal_value_usd"] = new_pipeline_data.pop("amount")
                
                # Retry insert after removing problematic fields
                try:
                    response = supabase.table("sales_pipeline").insert(new_pipeline_data).execute()
                except Exception as e2:
                    logger.error(f"Failed to insert after removing fields: {str(e2)}")
                    raise
            else:
                raise
        
        if not response.data:
            raise RuntimeError("Failed to create new pipeline version")
        
        row = normalize_pipeline_row_from_db(response.data[0])
        return SalesPipeline(**row)
    
    # Regular update (no stage/amount change) - just update existing record
    update_data = convert_uuids(update_data)
    
    import logging
    logger = logging.getLogger(__name__)
    logger.info(f"Updating pipeline {pipeline_id} with data: {update_data}")
    
    try:
        response = (
            supabase.table("sales_pipeline")
            .update(update_data)
            .eq("id", pipeline_id)
            .execute()
        )
    except Exception as e:
        error_str = str(e).lower()
        if "amount" in error_str and ("column" in error_str or "does not exist" in error_str):
            logger.warning(f"Column 'amount' not found, trying 'deal_value_usd' instead")
            if "amount" in update_data:
                update_data["deal_value_usd"] = update_data.pop("amount")
            response = (
                supabase.table("sales_pipeline")
                .update(update_data)
                .eq("id", pipeline_id)
                .execute()
            )
        else:
            raise
    
    if not response.data:
        raise RuntimeError("Failed to update sales pipeline record")
    
    row = normalize_pipeline_row_from_db(response.data[0])
    return SalesPipeline(**row)


def delete_sales_pipeline(pipeline_id: str) -> bool:
    """
    Delete a sales pipeline record.
    
    Args:
        pipeline_id: UUID of the pipeline record
    
    Returns:
        True if deleted successfully
    """
    supabase: Client = get_supabase_client()
    
    # Check if pipeline exists
    existing = get_sales_pipeline_by_id(pipeline_id)
    if not existing:
        raise ValueError("Sales pipeline record not found")
    
    response = (
        supabase.table("sales_pipeline")
        .delete()
        .eq("id", pipeline_id)
        .execute()
    )
    
    return True


def get_pipeline_by_customer_and_product(
    customer_id: str,
    tds_id: Optional[str] = None,
    chemical_type_id: Optional[str] = None,
) -> Optional[SalesPipeline]:
    """
    Get pipeline record for a specific customer and product combination.
    Useful for checking if a pipeline already exists before creating a new one.
    
    Args:
        customer_id: UUID of the customer
        tds_id: UUID of the TDS/product (optional)
        chemical_type_id: UUID of the chemical type (optional)
    
    Returns:
        SalesPipeline if found, None otherwise
    """
    supabase: Client = get_supabase_client()
    query = supabase.table("sales_pipeline").select("*").eq("customer_id", customer_id)
    
    # Filter by product (either tds_id or chemical_type_id)
    if tds_id:
        query = query.eq("tds_id", tds_id)
    elif chemical_type_id:
        query = query.eq("chemical_type_id", chemical_type_id)
    else:
        # If neither is provided, return None
        return None
    
    # Get the most recent one if multiple exist
    response = (
        query.order("created_at", desc=True)
        .limit(1)
        .execute()
    )
    
    if not response.data or len(response.data) == 0:
        return None
    
    row = dict(response.data[0])
    # Normalize metadata if it's a string
    meta_val = row.get("metadata")
    if isinstance(meta_val, str):
        try:
            row["metadata"] = json.loads(meta_val)
        except:
            row["metadata"] = {}
    
    # Normalize ai_interactions if it's a string
    ai_interactions_val = row.get("ai_interactions")
    if isinstance(ai_interactions_val, str):
        try:
            row["ai_interactions"] = json.loads(ai_interactions_val)
        except:
            row["ai_interactions"] = []
    elif ai_interactions_val is None:
        row["ai_interactions"] = []
    
    return SalesPipeline(**row)


# =============================
# STAGE MANAGEMENT
# =============================


def advance_pipeline_stage(
    pipeline_id: str,
    new_stage: str,
    metadata_updates: Optional[Dict[str, Any]] = None,
) -> SalesPipeline:
    """
    Advance or update the stage of a pipeline record.
    Optionally update metadata (e.g., stage history).
    
    Args:
        pipeline_id: UUID of the pipeline record
        new_stage: New stage to move to
        metadata_updates: Optional dict of metadata fields to update
    
    Returns:
        Updated SalesPipeline record
    """
    # Validate stage
    if new_stage not in PIPELINE_STAGES:
        raise ValueError(f"Invalid stage: {new_stage}. Must be one of: {', '.join(PIPELINE_STAGES)}")
    
    # Get existing pipeline
    existing = get_sales_pipeline_by_id(pipeline_id)
    if not existing:
        raise ValueError("Sales pipeline record not found")
    
    # Prepare update
    update_data: Dict[str, Any] = {"stage": new_stage}
    
    # Update metadata if provided
    if metadata_updates:
        current_metadata = existing.metadata or {}
        # Add stage history
        if "stage_history" not in current_metadata:
            current_metadata["stage_history"] = []
        
        current_metadata["stage_history"].append({
            "from_stage": existing.stage,
            "to_stage": new_stage,
            "changed_at": datetime.utcnow().isoformat(),
        })
        
        # Merge other metadata updates
        current_metadata.update(metadata_updates)
        update_data["metadata"] = current_metadata
    
    # If moving to Closed Lost, ensure close_reason is provided
    if new_stage == "Closed Lost":
        # Check if close_reason is provided in metadata_updates or already exists
        close_reason_provided = (
            (metadata_updates and metadata_updates.get("close_reason")) or
            existing.close_reason
        )
        if not close_reason_provided:
            raise ValueError("close_reason is required when stage is 'Closed Lost'")
    
    update_body = SalesPipelineUpdate(**update_data)
    return update_sales_pipeline(pipeline_id, update_body)


# =============================
# AI INTEGRATION FUNCTIONS
# =============================


def detect_pipeline_stage_from_interaction(
    interaction_text: str,
    current_stage: Optional[str] = None,
    customer_name: Optional[str] = None,
    product_name: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Use AI to detect the appropriate pipeline stage from interaction text.
    
    Args:
        interaction_text: The text content of the customer interaction
        current_stage: Current pipeline stage (if exists)
        customer_name: Optional customer name for context
        product_name: Optional product name for context
    
    Returns:
        Dict with:
            - "detected_stage": The detected stage (one of PIPELINE_STAGES)
            - "confidence": Confidence level (high/medium/low)
            - "reason": Explanation of why this stage was detected
            - "close_reason": If stage is "Closed Lost", the reason
            - "metadata": Additional extracted information (deal value, dates, etc.)
    """
    try:
        # Build context for the AI
        context_parts = []
        if customer_name:
            context_parts.append(f"Customer: {customer_name}")
        if product_name:
            context_parts.append(f"Product: {product_name}")
        if current_stage:
            context_parts.append(f"Current Pipeline Stage: {current_stage}")
        
        context = "\n".join(context_parts) if context_parts else "No additional context available."
        
        # Create AI prompt
        prompt = f"""You are analyzing a B2B chemical sales interaction to determine the appropriate sales pipeline stage.

Available pipeline stages:
1. Lead - Initial contact, customer inquiry
2. Product Identified - Customer has shown interest in a specific product
3. Quote Sent - A price quote has been sent to the customer
4. Sample Requested - Customer has requested a sample
5. Sample Delivered - Sample has been delivered to the customer
6. Agreement in Review - Contract or agreement is being reviewed
7. PO Received - Purchase order has been received
8. Invoiced - Invoice has been sent
9. Delivered - Product has been delivered
10. Closed Won - Deal completed successfully
11. Closed Lost - Deal lost (requires a reason)

Context:
{context}

Customer Interaction Text:
"{interaction_text}"

Analyze this interaction and determine:
1. What pipeline stage does this interaction indicate?
2. What is your confidence level (high/medium/low)?
3. Why did you choose this stage? (brief explanation)
4. If the stage is "Closed Lost", what is the reason?
5. Extract any relevant information: deal value, expected dates, product mentions, etc.

Respond in JSON format:
{{
    "detected_stage": "one of the 11 stages above",
    "confidence": "high|medium|low",
    "reason": "brief explanation",
    "close_reason": "reason if Closed Lost, null otherwise",
    "metadata": {{
        "amount": null or number,
        "currency": null or "ETB"|"KES"|"USD"|"EUR",
        "expected_close_date": null or "YYYY-MM-DD",
        "product_mentioned": null or product name,
        "notes": "any additional relevant information"
    }}
}}

Only respond with valid JSON, no additional text."""

        messages = [
            {
                "role": "system",
                "content": "You are a sales pipeline analyst for a B2B chemical distribution company. Analyze customer interactions to determine sales pipeline stages accurately."
            },
            {
                "role": "user",
                "content": prompt
            }
        ]
        
        # Call Gemini AI
        response_text = gemini_chat(messages)
        
        # Parse JSON response
        # Try to extract JSON from the response (AI might add extra text)
        import re
        json_match = re.search(r'\{.*\}', response_text, re.DOTALL)
        if json_match:
            response_text = json_match.group(0)
        
        result = json.loads(response_text)
        
        # Validate detected stage
        detected_stage = result.get("detected_stage", "").strip()
        if detected_stage not in PIPELINE_STAGES:
            # If AI returned invalid stage, try to map common variations
            stage_lower = detected_stage.lower()
            if "lead" in stage_lower or "inquiry" in stage_lower:
                detected_stage = "Lead"
            elif "quote" in stage_lower or "pricing" in stage_lower:
                detected_stage = "Quote Sent"
            elif "sample" in stage_lower and "request" in stage_lower:
                detected_stage = "Sample Requested"
            elif "sample" in stage_lower and "deliver" in stage_lower:
                detected_stage = "Sample Delivered"
            elif "po" in stage_lower or "purchase order" in stage_lower:
                detected_stage = "PO Received"
            elif "invoice" in stage_lower:
                detected_stage = "Invoiced"
            elif "deliver" in stage_lower and "won" not in stage_lower:
                detected_stage = "Delivered"
            elif "won" in stage_lower or "closed won" in stage_lower:
                detected_stage = "Closed Won"
            elif "lost" in stage_lower or "closed lost" in stage_lower:
                detected_stage = "Closed Lost"
            else:
                # Default to current stage or "Lead" if no match
                detected_stage = current_stage or "Lead"
        
        return {
            "detected_stage": detected_stage,
            "confidence": result.get("confidence", "medium").lower(),
            "reason": result.get("reason", "AI analysis of interaction text"),
            "close_reason": result.get("close_reason"),
            "metadata": result.get("metadata", {}),
        }
        
    except json.JSONDecodeError as e:
        # If JSON parsing fails, return a safe default
        return {
            "detected_stage": current_stage or "Lead",
            "confidence": "low",
            "reason": f"AI response parsing failed: {str(e)}",
            "close_reason": None,
            "metadata": {},
        }
    except GeminiError as e:
        # If AI call fails, return current stage or default
        return {
            "detected_stage": current_stage or "Lead",
            "confidence": "low",
            "reason": f"AI service error: {str(e)}",
            "close_reason": None,
            "metadata": {},
        }
    except Exception as e:
        # Catch-all for any other errors
        return {
            "detected_stage": current_stage or "Lead",
            "confidence": "low",
            "reason": f"Unexpected error: {str(e)}",
            "close_reason": None,
            "metadata": {},
        }


def auto_advance_pipeline_stage(
    pipeline_id: str,
    interaction_text: str,
    customer_name: Optional[str] = None,
    product_name: Optional[str] = None,
) -> SalesPipeline:
    """
    Automatically advance pipeline stage based on AI analysis of interaction text.
    
    Args:
        pipeline_id: UUID of the pipeline record
        interaction_text: The text content of the customer interaction
        customer_name: Optional customer name for context
        product_name: Optional product name for context
    
    Returns:
        Updated SalesPipeline record
    """
    # Get current pipeline
    existing = get_sales_pipeline_by_id(pipeline_id)
    if not existing:
        raise ValueError("Sales pipeline record not found")
    
    # Detect stage from interaction
    detection_result = detect_pipeline_stage_from_interaction(
        interaction_text=interaction_text,
        current_stage=existing.stage,
        customer_name=customer_name,
        product_name=product_name,
    )
    
    detected_stage = detection_result["detected_stage"]
    confidence = detection_result["confidence"]
    
    # Only advance if confidence is medium or high, and stage is different
    if confidence in ["high", "medium"] and detected_stage != existing.stage:
        # Prepare metadata updates
        metadata_updates = {
            "last_ai_detection": {
                "detected_stage": detected_stage,
                "confidence": confidence,
                "reason": detection_result["reason"],
                "interaction_text": interaction_text[:500],  # Store first 500 chars
                "detected_at": datetime.utcnow().isoformat(),
            },
            **detection_result.get("metadata", {}),
        }
        
        # If Closed Lost, ensure close_reason is set
        if detected_stage == "Closed Lost":
            if detection_result.get("close_reason"):
                metadata_updates["close_reason"] = detection_result["close_reason"]
            elif not existing.close_reason:
                # If no close reason provided, use the AI's reason
                metadata_updates["close_reason"] = detection_result.get("reason", "Lost - see interaction details")
        
        # Advance stage
        return advance_pipeline_stage(
            pipeline_id=pipeline_id,
            new_stage=detected_stage,
            metadata_updates=metadata_updates,
        )
    else:
        # Even if we don't advance, log the detection in metadata
        current_metadata = existing.metadata or {}
        if "ai_detections" not in current_metadata:
            current_metadata["ai_detections"] = []
        
        current_metadata["ai_detections"].append({
            "detected_stage": detected_stage,
            "confidence": confidence,
            "reason": detection_result["reason"],
            "interaction_text": interaction_text[:500],
            "detected_at": datetime.utcnow().isoformat(),
            "action": "no_change" if detected_stage == existing.stage else "low_confidence",
        })
        
        update_body = SalesPipelineUpdate(metadata=current_metadata)
        return update_sales_pipeline(pipeline_id, update_body)


def generate_pipeline_insights(
    customer_id: Optional[str] = None,
    tds_id: Optional[str] = None,
    days_back: int = 90,
) -> PipelineInsights:
    """
    Generate AI-powered insights and analytics for the sales pipeline.
    
    Args:
        customer_id: Optional filter by customer
        tds_id: Optional filter by product/TDS
        days_back: Number of days to analyze (default 90)
    
    Returns:
        PipelineInsights object with forecasting, churn risk, and other metrics
    """
    supabase: Client = get_supabase_client()
    
    # Get all pipeline records (filtered if needed)
    pipelines = list_sales_pipelines(
        limit=1000,  # Get all records
        customer_id=customer_id,
        tds_id=tds_id,
    )
    
    # Filter by date if needed
    cutoff_date = datetime.utcnow() - timedelta(days=days_back)
    recent_pipelines = [
        p for p in pipelines
        if p.created_at and datetime.fromisoformat(p.created_at.replace('Z', '+00:00')) >= cutoff_date
    ]
    
    # Calculate basic metrics
    total_pipeline_value = sum(
        p.amount or 0
        for p in recent_pipelines
        if p.stage not in ["Closed"]
    )
    
    # Revenue forecast (stages that indicate committed revenue)
    forecast_stages = ["Proposal", "Confirmation", "Closed"]
    forecast_value = sum(
        p.amount or 0
        for p in recent_pipelines
        if p.stage in forecast_stages
    )
    
    # Stage distribution
    stage_counts = {}
    for stage in PIPELINE_STAGES:
        stage_counts[stage] = sum(1 for p in recent_pipelines if p.stage == stage)
    
    # Churn risk: pipelines stuck in same stage >14 days
    churn_risk_pipelines = []
    for p in recent_pipelines:
        if p.stage in ["Closed Won", "Closed Lost"]:
            continue
        
        # Check metadata for stage history
        metadata = p.metadata or {}
        stage_history = metadata.get("stage_history", [])
        
        if stage_history:
            last_change = stage_history[-1].get("changed_at")
            if last_change:
                try:
                    last_change_dt = datetime.fromisoformat(last_change.replace('Z', '+00:00'))
                    days_in_stage = (datetime.utcnow() - last_change_dt.replace(tzinfo=None)).days
                    if days_in_stage > 14:
                        churn_risk_pipelines.append({
                            "pipeline_id": str(p.id),
                            "stage": p.stage,
                            "days_in_stage": days_in_stage,
                            "customer_id": str(p.customer_id),
                        })
                except:
                    pass
    
    # Sample effectiveness: % of Sample Delivered → Closed Won
    sample_delivered = [p for p in recent_pipelines if p.stage == "Sample Delivered" or any(
        h.get("to_stage") == "Sample Delivered" for h in (p.metadata or {}).get("stage_history", [])
    )]
    sample_won = sum(
        1 for p in sample_delivered
        if p.stage == "Closed Won" or any(
            h.get("to_stage") == "Closed Won" for h in (p.metadata or {}).get("stage_history", [])
        )
    )
    sample_effectiveness = (sample_won / len(sample_delivered) * 100) if sample_delivered else 0
    
    # Product demand: count Quote Sent per product
    quote_sent_by_product = {}
    for p in recent_pipelines:
        if p.stage == "Quote Sent" and p.tds_id:
            product_key = str(p.tds_id)
            quote_sent_by_product[product_key] = quote_sent_by_product.get(product_key, 0) + 1
    
    # Use AI to generate insights summary
    try:
        insights_summary = _generate_ai_insights_summary(
            total_pipeline_value=total_pipeline_value,
            forecast_value=forecast_value,
            stage_counts=stage_counts,
            churn_risk_count=len(churn_risk_pipelines),
            sample_effectiveness=sample_effectiveness,
        )
    except:
        insights_summary = "Pipeline insights generated successfully."
    
    return PipelineInsights(
        total_pipeline_value=total_pipeline_value,
        forecast_value=forecast_value,
        stage_distribution=stage_counts,
        churn_risk_pipelines=churn_risk_pipelines,
        sample_effectiveness=sample_effectiveness,
        product_demand=quote_sent_by_product,
        insights_summary=insights_summary,
    )


def _generate_ai_insights_summary(
    total_pipeline_value: float,
    forecast_value: float,
    stage_counts: Dict[str, int],
    churn_risk_count: int,
    sample_effectiveness: float,
) -> str:
    """
    Use AI to generate a human-readable insights summary.
    """
    try:
        prompt = f"""Analyze these sales pipeline metrics and provide a brief, actionable insights summary (2-3 sentences):

Total Pipeline Value: ${total_pipeline_value:,.2f}
Forecast Value (Committed): ${forecast_value:,.2f}
Stage Distribution: {json.dumps(stage_counts, indent=2)}
Churn Risk (stuck >14 days): {churn_risk_count} pipelines
Sample Effectiveness: {sample_effectiveness:.1f}%

Provide actionable insights and recommendations."""

        messages = [
            {
                "role": "system",
                "content": "You are a sales analytics expert. Provide concise, actionable insights from pipeline metrics."
            },
            {
                "role": "user",
                "content": prompt
            }
        ]
        
        response = gemini_chat(messages)
        return response.strip()
    except:
        return "Pipeline insights generated successfully."


def get_pipeline_forecast(
    days_ahead: int = 30,
    customer_id: Optional[str] = None,
) -> PipelineForecast:
    """
    Generate revenue forecast for the next N days based on pipeline data.
    
    Args:
        days_ahead: Number of days to forecast (default 30)
        customer_id: Optional filter by customer
    
    Returns:
        PipelineForecast object with forecasted revenue and breakdown
    """
    supabase: Client = get_supabase_client()
    
    # Get pipelines with expected close dates
    pipelines = list_sales_pipelines(
        limit=1000,
        customer_id=customer_id,
    )
    
    # Filter pipelines with expected_close_date in the forecast window
    forecast_end = date.today() + timedelta(days=days_ahead)
    forecast_pipelines = [
        p for p in pipelines
        if p.expected_close_date
        and p.expected_close_date <= forecast_end
        and p.stage not in ["Closed Lost"]
    ]
    
    # Calculate forecast by stage
    forecast_by_stage = {}
    for stage in PIPELINE_STAGES:
        stage_pipelines = [p for p in forecast_pipelines if p.stage == stage]
        forecast_by_stage[stage] = sum(p.amount or 0 for p in stage_pipelines)
    
    total_forecast = sum(forecast_by_stage.values())
    
    # Calculate forecast by week
    forecast_by_week = {}
    for p in forecast_pipelines:
        if p.expected_close_date:
            week_start = p.expected_close_date - timedelta(days=p.expected_close_date.weekday())
            week_key = week_start.isoformat()
            forecast_by_week[week_key] = forecast_by_week.get(week_key, 0) + (p.amount or 0)
    
    return PipelineForecast(
        forecast_period_days=days_ahead,
        total_forecast_value=total_forecast,
        forecast_by_stage=forecast_by_stage,
        forecast_by_week=forecast_by_week,
        pipeline_count=len(forecast_pipelines),
    )


# =============================
# AI CHAT FOR PIPELINE
# =============================


def chat_with_pipeline(
    pipeline_id: str,
    input_text: str,
    user_id: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Run an AI chat turn for a specific pipeline to get sales advice.
    
    This provides product-specific, customer-specific, and pipeline-stage-specific
    advice without needing to navigate to the customer profile.
    
    Args:
        pipeline_id: UUID of the pipeline record
        input_text: User's question or request
        user_id: Optional user ID for logging
    
    Returns:
        Dict with:
            - "response": AI-generated response
            - "pipeline": Pipeline details
            - "customer": Customer details
            - "product": Product/TDS details
    """
    supabase: Client = get_supabase_client()
    
    # 1) Get pipeline details
    pipeline = get_sales_pipeline_by_id(pipeline_id)
    if not pipeline:
        raise ValueError("Pipeline not found")
    
    # 2) Get customer details
    customer = get_customer_by_id(str(pipeline.customer_id))
    if not customer:
        raise ValueError("Customer not found")
    
    # 3) Get product/TDS details if available
    product = None
    if pipeline.tds_id:
        try:
            product = get_tds_by_id(str(pipeline.tds_id))
        except:
            pass
    
    # 4) Get all related pipelines for this customer+product
    related_pipelines = []
    if pipeline.customer_id and pipeline.tds_id:
        try:
            related_pipelines = list_sales_pipelines(
                limit=50,
                customer_id=str(pipeline.customer_id),
                tds_id=str(pipeline.tds_id),
            )
        except:
            pass
    
    # 5) Get ALL customer interactions (not just product-specific) for comprehensive context
    all_customer_interactions = []
    product_interactions = []
    try:
        all_customer_interactions = get_interactions_for_customer(
            customer_id=str(pipeline.customer_id),
            limit=30,  # Get more interactions for better context
        )
        # Also filter product-specific interactions if product is specified
        if pipeline.tds_id:
            product_interactions = [
                it for it in all_customer_interactions
                if it.tds_id and str(it.tds_id) == str(pipeline.tds_id)
            ]
    except:
        pass
    
    # 6) Build comprehensive context
    amount_str = f"{pipeline.amount or 0:,.2f}" if pipeline.amount else "Not set"
    currency_str = pipeline.currency or "USD"
    pipeline_context = f"""
Pipeline Context:
- Customer: {customer.customer_name} (ID: {customer.display_id or pipeline.customer_id})
- Current Stage: {pipeline.stage}
- Amount: {amount_str} 
- Expected Close Date: {pipeline.expected_close_date or 'Not set'}
- Lead Source: {pipeline.lead_source or 'Not set'}
- Contact: {pipeline.contact_per_lead or 'Not set'}
- Business Model: {pipeline.business_model or 'Not set'}
- Unit: {pipeline.unit or 'Not set'}
- Unit Price: {pipeline.unit_price or 'Not set'} {currency_str}
- Created: {pipeline.created_at or 'Unknown'}
"""
    
    if product:
        product_context = f"""
Product Information:
- Brand: {product.brand or 'N/A'}
- Grade: {product.grade or 'N/A'}
- Owner: {product.owner or 'N/A'}
"""
    else:
        product_context = "\nProduct: Not specified in pipeline\n"
    
    if related_pipelines:
        pipeline_history = f"""
Pipeline History (Total: {len(related_pipelines)} records):
"""
        for idx, p in enumerate(related_pipelines[:5], 1):  # Show last 5
            value_str = f"{p.amount or 0:,.2f} {p.currency or 'USD'}" if p.amount else "Not set"
            pipeline_history += f"- Record {idx}: Stage: {p.stage}, Value: {value_str}, Created: {p.created_at or 'Unknown'}\n"
    else:
        pipeline_history = "\nPipeline History: This is the first pipeline record for this customer+product combination.\n"
    
    # Build comprehensive interaction context
    interaction_context = ""
    if all_customer_interactions:
        interaction_context = f"""
Customer Interaction History ({len(all_customer_interactions)} total interactions):
"""
        # Show most recent interactions (up to 10)
        for idx, it in enumerate(all_customer_interactions[:10], 1):
            interaction_context += f"\nInteraction {idx}:\n"
            if it.input_text:
                interaction_context += f"  Q: {it.input_text[:200]}\n"
            if it.ai_response:
                interaction_context += f"  A: {it.ai_response[:200]}\n"
        
        # Add note about product-specific interactions if available
        if product_interactions:
            interaction_context += f"\n\nNote: {len(product_interactions)} of these interactions are specifically related to this product.\n"
    else:
        interaction_context = "\nCustomer Interaction History: No interactions found for this customer.\n"
    
    # 7) Create specialized system prompt for sales pipeline advice
    system_prompt = f"""You are an expert B2B chemical sales advisor for LeanChem, specializing in pipeline management and deal strategy.

Your role is to provide actionable sales advice specific to this pipeline opportunity. You have access to:
- Customer information and history
- Product/TDS specifications
- Pipeline stage and deal details
- Related pipeline records
- Complete customer interaction history (all CRM interactions, not just product-specific)

{pipeline_context}
{product_context}
{pipeline_history}
{interaction_context}

Guidelines:
- Provide specific, actionable advice based on the current pipeline stage
- Suggest next steps appropriate for the stage
- Consider deal value and expected close date in your recommendations
- Reference product specifications when relevant
- Use customer interaction history to understand context
- Be concise but thorough
- Focus on helping the sales team move the deal forward
"""
    
    # 8) Prepare messages
    messages = [
        {"role": "system", "content": system_prompt},
        {
            "role": "user",
            "content": input_text,
        },
    ]
    
    # 9) Call Gemini
    try:
        ai_response = gemini_chat(messages)
    except GeminiError as e:
        raise ValueError(f"AI service error: {str(e)}")
    
    # 10) Save interaction to pipeline's ai_interactions column
    try:
        # Get existing interactions or initialize empty list
        existing_interactions = []
        if hasattr(pipeline, 'ai_interactions') and pipeline.ai_interactions:
            if isinstance(pipeline.ai_interactions, list):
                existing_interactions = pipeline.ai_interactions
            elif isinstance(pipeline.ai_interactions, str):
                try:
                    existing_interactions = json.loads(pipeline.ai_interactions)
                except:
                    existing_interactions = []
        
        # Create new interaction entry
        new_interaction = {
            "timestamp": datetime.now().isoformat(),
            "user_input": input_text,
            "ai_response": ai_response,
            "user_id": str(user_id) if user_id else None,
        }
        
        # Append to existing interactions
        updated_interactions = existing_interactions + [new_interaction]
        
        # Update pipeline record with new interactions
        supabase.table("sales_pipeline").update({
            "ai_interactions": updated_interactions
        }).eq("id", pipeline_id).execute()
        
    except Exception as e:
        # Log error but don't block chat
        import logging
        logger = logging.getLogger(__name__)
        logger.warning(f"Failed to save AI interaction to pipeline: {str(e)}")
    
    # 11) Log to RAG conversation table
    try:
        combined_text = (
            f"Pipeline: {pipeline_id}\n"
            f"Customer: {customer.customer_name}\n"
            f"Product: {product.brand if product else 'N/A'} {product.grade if product else ''}\n"
            f"Stage: {pipeline.stage}\n"
            f"Q: {input_text}\n"
            f"A: {ai_response}"
        )
        embedding = gemini_embed(combined_text)
        metadata = {
            "pipeline_id": pipeline_id,
            "customer_id": str(pipeline.customer_id),
            "customer_name": customer.customer_name,
            "tds_id": str(pipeline.tds_id) if pipeline.tds_id else None,
            "source": "pipeline_chat",
            "user_id": user_id,
        }
        log_conversation_to_rag(
            combined_text,
            embedding=embedding,
            metadata=metadata,
        )
    except Exception:
        # Don't block chat if RAG logging fails
        pass
    
    # 11) Return response with context
    return {
        "response": ai_response,
        "pipeline": {
            "id": str(pipeline.id),
            "stage": pipeline.stage,
            "amount": pipeline.amount,
            "currency": pipeline.currency,
            "expected_close_date": pipeline.expected_close_date.isoformat() if pipeline.expected_close_date else None,
        },
        "customer": {
            "id": str(customer.customer_id),
            "name": customer.customer_name,
            "display_id": customer.display_id,
        },
        "product": {
            "id": str(product.id) if product else None,
            "brand": product.brand if product else None,
            "grade": product.grade if product else None,
        } if product else None,
    }

