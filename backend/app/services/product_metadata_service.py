"""
Budget-optimized product metadata (SEO + technical summary).

Cache-first: never call Gemini if both fields already exist on public.products.
Generation uses Gemini Flash only, max 150 output tokens, strict JSON.
On API/rate-limit failure, return empty fields — do not raise to the page.
"""

from __future__ import annotations

import json
import logging
import re
from typing import Any, Optional
import asyncio

from app.config import settings
from app.database.connection import get_supabase_service_client

logger = logging.getLogger(__name__)

FLASH_MODEL = "gemini-2.5-flash"
MAX_OUTPUT_TOKENS = 150

METADATA_SCHEMA: dict[str, Any] = {
    "type": "OBJECT",
    "properties": {
        "seo_description": {"type": "STRING"},
        "technical_summary": {"type": "STRING"},
    },
    "required": ["seo_description", "technical_summary"],
}

SYSTEM_PROMPT = (
    "You write short chemical-product copy for LeanChem. "
    "Return JSON only with seo_description and technical_summary. "
    "Each field must be one or two sentences. No markdown."
)


def _parse_json_object(raw: str) -> dict[str, Any]:
    text = (raw or "").strip()
    if text.startswith("```"):
        text = re.sub(r"^```(?:json)?\s*", "", text)
        text = re.sub(r"\s*```$", "", text)
    parsed = json.loads(text)
    if not isinstance(parsed, dict):
        raise ValueError("metadata JSON was not an object")
    return parsed


def _normalize_fields(payload: dict[str, Any]) -> tuple[str, str]:
    seo = str(payload.get("seo_description") or "").strip()
    tech = str(payload.get("technical_summary") or "").strip()
    return seo, tech


def _row_has_cache(row: dict[str, Any]) -> bool:
    seo = (row.get("seo_description") or "").strip()
    tech = (row.get("technical_summary") or "").strip()
    return bool(seo and tech)


def _empty_result(*, cached: bool, error: Optional[str] = None) -> dict[str, Any]:
    return {
        "seo_description": None,
        "technical_summary": None,
        "cached": cached,
        "generated": False,
        "error": error,
    }


def _generate_with_flash(raw_product_data: dict[str, Any]) -> tuple[str, str]:
    from google import genai
    from google.genai import types

    key = (settings.GEMINI_API_KEY or "").strip()
    if not key:
        raise RuntimeError("GEMINI_API_KEY is not configured")

    client = genai.Client(api_key=key)
    prompt = json.dumps({"product": raw_product_data}, default=str)
    response = client.models.generate_content(
        model=FLASH_MODEL,
        contents=prompt,
        config=types.GenerateContentConfig(
            system_instruction=SYSTEM_PROMPT,
            max_output_tokens=MAX_OUTPUT_TOKENS,
            temperature=0.2,
            response_mime_type="application/json",
            response_schema=METADATA_SCHEMA,
        ),
    )
    text = getattr(response, "text", None)
    if not text:
        candidates = getattr(response, "candidates", None) or []
        chunks: list[str] = []
        for candidate in candidates:
            content = getattr(candidate, "content", None)
            parts = getattr(content, "parts", None) if content else None
            if not parts:
                continue
            for part in parts:
                if getattr(part, "thought", False):
                    continue
                part_text = getattr(part, "text", None)
                if part_text:
                    chunks.append(str(part_text))
        text = "\n".join(chunks)
    parsed = _parse_json_object(str(text or ""))
    seo, tech = _normalize_fields(parsed)
    if not seo or not tech:
        raise RuntimeError("Gemini returned incomplete metadata JSON")
    return seo, tech


async def get_or_generate_product_metadata(
    product_id: str,
    raw_product_data: Optional[dict[str, Any]] = None,
) -> dict[str, Any]:
    """
    Database-first metadata. Gemini Flash is called only when both
    seo_description and technical_summary are missing.
    """
    try:
        client = get_supabase_service_client()
        fetched = (
            client.table("products").select("*").eq("id", product_id).limit(1).execute()
        )
        rows = fetched.data or []
        if not rows:
            return _empty_result(cached=False, error="Product not found")
        row = rows[0]
        if _row_has_cache(row):
            return {
                "seo_description": row.get("seo_description"),
                "technical_summary": row.get("technical_summary"),
                "cached": True,
                "generated": False,
                "error": None,
            }

        payload = dict(raw_product_data or {})
        for key in ("chemical", "chemical_type", "brand", "packaging", "use_case"):
            if key not in payload and row.get(key) is not None:
                payload[key] = row.get(key)

        seo, tech = await asyncio.to_thread(_generate_with_flash, payload)
        client.table("products").update(
            {"seo_description": seo, "technical_summary": tech}
        ).eq("id", product_id).execute()
        return {
            "seo_description": seo,
            "technical_summary": tech,
            "cached": False,
            "generated": True,
            "error": None,
        }
    except Exception as exc:
        logger.warning("get_or_generate_product_metadata failed: %s", exc)
        message = str(exc)
        if "429" in message or "RESOURCE_EXHAUSTED" in message.upper():
            return _empty_result(cached=False, error="rate_limited")
        return _empty_result(cached=False, error="generation_failed")
