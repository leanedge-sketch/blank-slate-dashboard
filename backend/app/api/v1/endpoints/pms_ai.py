"""PMS AI assistants. Mapping suggestions only — never writes to the database."""

from __future__ import annotations

import json
import logging
import re
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from app.dependencies import get_current_user
from app.services.ai_service import get_ai_service

logger = logging.getLogger(__name__)

router = APIRouter()

CANONICAL_SCHEMA = [
    "chemical_master_id",
    "base_cost_usd",
    "incoterm",
    "location",
    "currency",
]

MAPPING_SYSTEM_PROMPT = (
    "You are a data mapping assistant. Map the provided vendor CSV headers to our "
    "canonical schema: ['chemical_master_id', 'base_cost_usd', 'incoterm', 'location', "
    "'currency']. Return ONLY a valid JSON object where keys are the CSV headers and "
    "values are the matched canonical schema keys (or null if no match)."
)


class PredictCsvMappingRequest(BaseModel):
    headers: List[str] = Field(default_factory=list)
    sample_rows: List[Dict[str, Any]] = Field(default_factory=list)


class PredictCsvMappingResponse(BaseModel):
    mapping: Dict[str, Optional[str]]
    provider_used: str
    is_fallback: bool


def _extract_json_object(text: str) -> Dict[str, Any]:
    raw = (text or "").strip()
    if raw.startswith("```"):
        raw = re.sub(r"^```(?:json)?\s*", "", raw)
        raw = re.sub(r"\s*```$", "", raw)
    try:
        parsed = json.loads(raw)
        if isinstance(parsed, dict):
            return parsed
    except json.JSONDecodeError:
        pass
    match = re.search(r"\{[\s\S]*\}", raw)
    if not match:
        raise ValueError("Model did not return a JSON object")
    parsed = json.loads(match.group(0))
    if not isinstance(parsed, dict):
        raise ValueError("Model JSON was not an object")
    return parsed


def _sanitize_mapping(headers: List[str], raw: Dict[str, Any]) -> Dict[str, Optional[str]]:
    allowed = set(CANONICAL_SCHEMA)
    mapping: Dict[str, Optional[str]] = {}
    for header in headers:
        value = raw.get(header)
        if value is None:
            mapping[header] = None
            continue
        key = str(value).strip()
        mapping[header] = key if key in allowed else None
    return mapping


@router.post("/predict-csv-mapping", response_model=PredictCsvMappingResponse)
async def predict_csv_mapping(
    body: PredictCsvMappingRequest,
    _user: dict = Depends(get_current_user),
):
    """Suggest CSV header → canonical column mapping. Does not write data."""
    headers = [str(h) for h in (body.headers or []) if str(h).strip()]
    if not headers:
        raise HTTPException(status_code=400, detail="headers are required")

    sample_rows = (body.sample_rows or [])[:3]
    user_prompt = json.dumps(
        {"csv_headers": headers, "sample_rows": sample_rows},
        default=str,
    )
    try:
        result = await get_ai_service().generate_text(
            prompt=user_prompt,
            system_instruction=MAPPING_SYSTEM_PROMPT,
            task_type="extraction",
            timeout_seconds=25.0,
            max_tokens=1024,
            json_mode=True,
        )
    except Exception as exc:
        logger.exception("predict-csv-mapping failed")
        raise HTTPException(status_code=502, detail=f"AI mapping failed: {exc}") from exc

    try:
        parsed = _extract_json_object(str(result.get("content") or ""))
        mapping = _sanitize_mapping(headers, parsed)
    except Exception as exc:
        raise HTTPException(
            status_code=502,
            detail=f"AI mapping returned invalid JSON: {exc}",
        ) from exc

    return PredictCsvMappingResponse(
        mapping=mapping,
        provider_used=str(result.get("provider_used") or "unknown"),
        is_fallback=bool(result.get("is_fallback")),
    )


# Mapping uses task_type="extraction" → TaskComplexity.HIGH_VOLUME_FAST (OpenAI gpt-4o-mini failover).


class ProductMetadataRequest(BaseModel):
    raw_product_data: Dict[str, Any] = Field(default_factory=dict)


class ProductMetadataResponse(BaseModel):
    seo_description: Optional[str] = None
    technical_summary: Optional[str] = None
    cached: bool = False
    generated: bool = False
    error: Optional[str] = None


@router.post("/products/{product_id}/metadata", response_model=ProductMetadataResponse)
async def get_or_generate_product_metadata_endpoint(
    product_id: str,
    body: ProductMetadataRequest | None = None,
    _user: dict = Depends(get_current_user),
):
    """Cache-first Gemini Flash SEO/technical copy. Never crashes the caller."""
    from app.services.product_metadata_service import get_or_generate_product_metadata

    payload = (body.raw_product_data if body else {}) or {}
    result = await get_or_generate_product_metadata(product_id, payload)
    return ProductMetadataResponse(**result)
