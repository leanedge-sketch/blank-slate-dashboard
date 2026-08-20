"""Sales AI assistants. Extraction only — never writes pipeline rows."""

from __future__ import annotations

import json
import logging
import re
from typing import Any

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile

from app.dependencies import get_current_user
from app.services.ai_service import get_ai_service

logger = logging.getLogger(__name__)

router = APIRouter()

EXTRACT_SYSTEM_PROMPT = (
    "You are a commercial deal extractor. Parse this RFQ/Quote document and extract "
    "the following into a strict JSON object: 'product_name', 'quantity', 'unit' "
    "(e.g., MT, KG), 'target_amount', 'currency', and 'incoterm'. If a field is "
    "missing, return null for that key."
)

EXTRACT_KEYS = (
    "product_name",
    "quantity",
    "unit",
    "target_amount",
    "currency",
    "incoterm",
)


def _pdf_to_text(data: bytes) -> str:
    import fitz

    doc = fitz.open(stream=data, filetype="pdf")
    try:
        return "\n".join(page.get_text() or "" for page in doc).strip()
    finally:
        doc.close()


def _extract_json_object(text: str) -> dict:
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


def _sanitize(raw: dict[str, Any]) -> dict[str, Any]:
    out: dict[str, Any] = {}
    for key in EXTRACT_KEYS:
        value = raw.get(key)
        if value is None or value == "":
            out[key] = None
            continue
        if key in ("quantity", "target_amount"):
            try:
                out[key] = float(str(value).replace(",", "").strip())
            except (TypeError, ValueError):
                out[key] = None
        else:
            out[key] = str(value).strip() or None
    return out


@router.post("/extract-pdf")
async def extract_pdf(
    file: UploadFile = File(...),
    _user: dict = Depends(get_current_user),
):
    """Parse an RFQ/quote PDF into form fields. Does not persist a deal."""
    filename = (file.filename or "upload.pdf").lower()
    if not filename.endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Upload a PDF file")
    data = await file.read()
    if not data:
        raise HTTPException(status_code=400, detail="Empty file")
    if len(data) > 12 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="PDF is larger than 12MB")

    try:
        extracted_text = _pdf_to_text(data)
    except Exception as exc:
        logger.exception("PyMuPDF failed")
        raise HTTPException(status_code=400, detail=f"Could not read PDF: {exc}") from exc

    if not extracted_text:
        raise HTTPException(status_code=422, detail="No extractable text in this PDF")

    try:
        result = await get_ai_service().generate_text(
            prompt=extracted_text[:24000],
            system_instruction=EXTRACT_SYSTEM_PROMPT,
            task_type="extraction",
            timeout_seconds=25.0,
            max_tokens=1024,
            json_mode=True,
        )
        parsed = _sanitize(_extract_json_object(str(result.get("content") or "")))
    except Exception as exc:
        logger.exception("extract-pdf failed")
        raise HTTPException(status_code=502, detail=f"AI extraction failed: {exc}") from exc

    return {
        "fields": parsed,
        "provider_used": result.get("provider_used"),
        "is_fallback": bool(result.get("is_fallback")),
        "wrote_to_database": False,
    }
