"""
ICP Context Service
===================

Builds the full context for Ideal Customer Profile (ICP) generation by pulling:
- Customer master data
- Recent interactions (optionally scoped to a specific pipeline)
- Sales pipeline records for the customer
- External web and LinkedIn context (when pointers are missing/stale)
- RAG semantic matches from the conversation table

This module is intentionally read-only and side-effect free. It:
- DOES query multiple tables and external services
- DOES return a rich context string + metadata
- DOES NOT write back to the database (worker is responsible for updates)
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional, Tuple

import logging

from supabase import Client

from app.database.connection import get_supabase_client
from app.services.ai_service import search_documents
from app.services.web_search_service import (
    search_web_for_company,
    search_linkedin_profiles_ethiopia,
)


def _get_supabase() -> Client:
    return get_supabase_client()


def _parse_timestamp(value: Any) -> Optional[datetime]:
    """Best-effort parse of ISO timestamps from Supabase rows."""
    if not value:
        return None
    if isinstance(value, datetime):
        return value
    try:
        # Supabase usually returns ISO 8601 strings
        return datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    except Exception:
        return None


def _should_refresh_external(external_last_fetched_at: Optional[Any]) -> bool:
    """
    Decide whether we should re-fetch external web/LinkedIn context.

    Strategy:
    - If never fetched -> True
    - If older than 30 days -> True
    - Else -> False
    """
    last = _parse_timestamp(external_last_fetched_at)
    if last is None:
        return True

    now = datetime.now(timezone.utc)
    return now - last > timedelta(days=30)


def _fetch_customer_row(customer_id: str) -> Optional[Dict[str, Any]]:
    supabase = _get_supabase()
    resp = (
        supabase.table("customers")
        .select("*")
        .eq("customer_id", customer_id)
        .limit(1)
        .execute()
    )
    if not resp.data:
        return None
    return resp.data[0]


def _fetch_recent_interactions(
    customer_id: str, pipeline_id: Optional[str] = None, limit: int = 50
) -> List[Dict[str, Any]]:
    supabase = _get_supabase()
    query = (
        supabase.table("interactions")
        .select("*")
        .eq("customer_id", customer_id)
        .order("created_at", desc=True)
        .limit(limit)
    )

    if pipeline_id:
        query = query.eq("pipeline_id", pipeline_id)

    resp = query.execute()
    return resp.data or []


def _fetch_pipelines_for_customer(
    customer_id: str, pipeline_id: Optional[str] = None
) -> List[Dict[str, Any]]:
    supabase = _get_supabase()
    query = supabase.table("sales_pipeline").select("*")

    if pipeline_id:
        query = query.eq("id", pipeline_id)
    else:
        query = query.eq("customer_id", customer_id)

    resp = query.order("created_at", desc=True).execute()
    return resp.data or []


def _build_interactions_section(interactions: List[Dict[str, Any]]) -> str:
    if not interactions:
        return "No recorded interactions yet.\n"

    lines: List[str] = []
    lines.append("Recent Interactions (newest first):")
    for row in interactions:
        created_at = _parse_timestamp(row.get("created_at"))
        created_str = (
            created_at.astimezone(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
            if created_at
            else "Unknown time"
        )
        user_text = (row.get("input_text") or "").strip()
        ai_text = (row.get("ai_response") or "").strip()
        pipeline_id = row.get("pipeline_id")

        header = f"- [{created_str}]"
        if pipeline_id:
            header += f" (Pipeline: {pipeline_id})"
        lines.append(header)

        if user_text:
            lines.append(f"  User: {user_text}")
        if ai_text:
            lines.append(f"  AI: {ai_text}")

    return "\n".join(lines) + "\n"


def _build_pipelines_section(pipelines: List[Dict[str, Any]]) -> str:
    if not pipelines:
        return "No active sales pipelines for this customer.\n"

    lines: List[str] = []
    lines.append("Sales Pipeline Overview:")
    for p in pipelines:
        stage = p.get("stage") or "Unknown"
        amount = p.get("deal_value_usd") or p.get("amount")
        expected_close = p.get("expected_close_date")
        tds_id = p.get("tds_id")
        chemical_type_id = p.get("chemical_type_id")

        parts: List[str] = [f"Stage: {stage}"]
        if amount is not None:
            parts.append(f"Amount: {amount}")
        if expected_close:
            parts.append(f"Expected Close: {expected_close}")
        if tds_id:
            parts.append(f"TDS: {tds_id}")
        if chemical_type_id:
            parts.append(f"Chemical Type: {chemical_type_id}")

        lines.append("- " + " | ".join(parts))

    return "\n".join(lines) + "\n"


def _build_rag_section(
    customer_name: str, recent_interactions: List[Dict[str, Any]]
) -> Tuple[str, List[Dict[str, Any]]]:
    # Use customer name + short summary of last interaction as query
    if recent_interactions:
        latest = recent_interactions[0]
        snippet_parts: List[str] = []
        if latest.get("input_text"):
            snippet_parts.append(str(latest["input_text"])[:200])
        if latest.get("ai_response"):
            snippet_parts.append(str(latest["ai_response"])[:200])
        snippet = " | ".join(snippet_parts)
        query = f"{customer_name} :: {snippet}"
    else:
        query = customer_name

    try:
        matches = search_documents(query=query, user_id=None, limit=5)
    except Exception as e:
        logging.warning(f"RAG search_documents failed for '{query}': {e}")
        matches = []

    if not matches:
        return "No similar past conversations found in RAG index.\n", []

    lines: List[str] = []
    lines.append("Similar Past Cases (RAG):")
    for m in matches:
        content = (m.get("content") or "").strip()
        if not content:
            continue
        lines.append("- " + content[:400])

    return "\n".join(lines) + "\n", matches


def _build_external_section(
    customer_row: Dict[str, Any],
) -> Tuple[str, Optional[datetime]]:
    """
    Build external context (web + LinkedIn).

    Returns:
        (external_text, external_fetched_at_if_refreshed)
    """
    customer_name = customer_row.get("customer_name") or ""
    external_last_fetched_at = customer_row.get("external_last_fetched_at")

    # Decide if we should fetch
    if not _should_refresh_external(external_last_fetched_at):
        return "External data considered fresh; skipping re-fetch.\n", None

    # For now we use existing search functions keyed by company name.
    # Later we can add URL-based scraping when website_url/linkedin_company_url are present.
    try:
        web_ctx = search_web_for_company(customer_name)
    except Exception as e:
        logging.warning(f"Web search failed for '{customer_name}': {e}")
        web_ctx = "Web search failed.\n"

    try:
        linkedin_ctx = search_linkedin_profiles_ethiopia(customer_name)
    except Exception as e:
        logging.warning(f"LinkedIn search failed for '{customer_name}': {e}")
        linkedin_ctx = "LinkedIn search failed.\n"

    now = datetime.now(timezone.utc)
    parts = [
        "External Web Context:",
        web_ctx or "No web context.",
        "",
        "LinkedIn Context (Ethiopia):",
        linkedin_ctx or "No LinkedIn context.",
    ]
    return "\n".join(parts) + "\n", now


def build_customer_context(
    customer_id: str,
    interaction_id: Optional[str] = None,
    pipeline_id: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Build a rich context bundle for ICP generation.

    Returns dict with:
      - customer: raw customer row
      - interactions: list of recent interactions
      - pipelines: list of pipelines
      - rag_matches: list of RAG matches
      - external_fetched_at: datetime if external data was refreshed
      - context_text: final assembled plain-text context
    """
    customer_row = _fetch_customer_row(customer_id)
    if not customer_row:
        raise ValueError(f"Customer {customer_id} not found")

    # If interaction_id is provided, we still fetch a window of interactions.
    recent_interactions = _fetch_recent_interactions(
        customer_id=customer_id, pipeline_id=pipeline_id
    )
    pipelines = _fetch_pipelines_for_customer(
        customer_id=customer_id, pipeline_id=pipeline_id
    )

    external_section, external_fetched_at = _build_external_section(customer_row)
    rag_section, rag_matches = _build_rag_section(
        customer_name=customer_row.get("customer_name", ""), recent_interactions=recent_interactions
    )

    # Assemble final context text
    header_lines = [
        f"Customer: {customer_row.get('customer_name', '')}",
        f"Display ID: {customer_row.get('display_id', '')}",
        f"Sales Stage: {customer_row.get('sales_stage', '')}",
        f"Website: {customer_row.get('website_url') or 'N/A'}",
        f"LinkedIn: {customer_row.get('linkedin_company_url') or 'N/A'}",
        f"Primary Contact: {customer_row.get('primary_contact_name') or 'N/A'}",
    ]

    interactions_section = _build_interactions_section(recent_interactions)
    pipelines_section = _build_pipelines_section(pipelines)

    context_parts = [
        "=== CUSTOMER SNAPSHOT ===",
        "\n".join(header_lines),
        "",
        "=== INTERACTIONS ===",
        interactions_section,
        "",
        "=== SALES PIPELINE ===",
        pipelines_section,
        "",
        "=== EXTERNAL CONTEXT ===",
        external_section,
        "",
        "=== RAG SIMILAR CASES ===",
        rag_section,
    ]

    context_text = "\n".join(context_parts)

    return {
        "customer": customer_row,
        "interactions": recent_interactions,
        "pipelines": pipelines,
        "rag_matches": rag_matches,
        "external_fetched_at": external_fetched_at,
        "context_text": context_text,
    }



