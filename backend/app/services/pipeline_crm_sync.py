"""
Sync CRM interactions with sales_pipeline records.

- Links interactions.pipeline_id when missing
- Mirrors CRM activity into pipeline ai_interactions
- Advances pipeline stage from interaction text + customer sales_stage (1–7)
"""

from __future__ import annotations

import json
import logging
from datetime import datetime
from typing import Any, Dict, List, Optional

from app.database.connection import get_supabase_client
from app.models.crm import Interaction
from app.models.sales_pipeline import SalesPipeline, SalesPipelineCreate, SalesPipelineUpdate
from app.services.sales_pipeline_service import (
    PIPELINE_STAGES,
    advance_pipeline_stage,
    auto_advance_pipeline_stage,
    create_sales_pipeline,
    get_sales_pipeline_by_id,
    list_sales_pipelines,
    update_sales_pipeline,
)

logger = logging.getLogger(__name__)

CRM_SALES_STAGE_TO_PIPELINE: Dict[str, str] = {
    "1": "Lead ID",
    "2": "Discovery",
    "3": "Sample",
    "4": "Validation",
    "5": "Proposal",
    "6": "Confirmation",
    "7": "Closed",
}

_STAGE_INDEX = {s: i for i, s in enumerate([x for x in PIPELINE_STAGES if x != "Lost"])}


def _stage_rank(stage: Optional[str]) -> int:
    if not stage:
        return -1
    return _STAGE_INDEX.get(stage, -1)


def _interaction_body(interaction: Interaction) -> str:
    parts: List[str] = []
    if interaction.input_text:
        parts.append(str(interaction.input_text))
    if interaction.ai_response:
        parts.append(str(interaction.ai_response))
    return "\n".join(parts).strip()


def _heuristic_stage_from_text(text: str) -> Optional[str]:
    lower = text.lower()
    if any(w in lower for w in ("closed won", "purchase order received", "po received", "deal won")):
        return "Closed"
    if any(w in lower for w in ("lost deal", "closed lost", "not proceeding", "no longer interested")):
        return "Lost"
    if "sample" in lower and any(w in lower for w in ("sent", "delivered", "received", "testing")):
        return "Sample"
    if any(w in lower for w in ("quotation", "quote sent", "proposal", "pricing")):
        return "Proposal"
    if any(w in lower for w in ("validation", "trial", "pilot")):
        return "Validation"
    if any(w in lower for w in ("confirmation", "agreement", "contract signed")):
        return "Confirmation"
    if any(w in lower for w in ("discovery", "needs analysis", "requirement")):
        return "Discovery"
    if any(w in lower for w in ("lead", "inquiry", "first contact", "intro")):
        return "Lead ID"
    return None


def _resolve_pipeline_for_interaction(
    interaction: Interaction,
) -> Optional[SalesPipeline]:
    if interaction.pipeline_id:
        existing = get_sales_pipeline_by_id(str(interaction.pipeline_id))
        if existing:
            return existing

    customer_id = str(interaction.customer_id)
    tds_id = str(interaction.tds_id) if interaction.tds_id else None

    candidates = list_sales_pipelines(
        limit=50,
        offset=0,
        customer_id=customer_id,
        tds_id=tds_id,
        latest_per_deal=True,
    )
    if candidates:
        if tds_id:
            for p in candidates:
                if p.tds_id and str(p.tds_id) == tds_id:
                    return p
        return candidates[0]

    try:
        body = SalesPipelineCreate(
            customer_id=interaction.customer_id,
            tds_id=interaction.tds_id,
            stage="Lead ID",
        )
        return create_sales_pipeline(body)
    except Exception as e:
        logger.warning("Could not create pipeline for customer %s: %s", customer_id, e)
        return None


def _link_interaction_to_pipeline(interaction_id: str, pipeline_id: str) -> None:
    supabase = get_supabase_client()
    supabase.table("interactions").update({"pipeline_id": pipeline_id}).eq(
        "id", interaction_id
    ).execute()


def _append_crm_snapshot_to_pipeline(
    pipeline: SalesPipeline, interaction: Interaction
) -> None:
    text = _interaction_body(interaction)
    entry: Dict[str, Any] = {
        "source": "crm",
        "interaction_id": str(interaction.id),
        "input_text": (interaction.input_text or "")[:4000],
        "ai_response": (interaction.ai_response or "")[:4000],
        "created_at": (
            interaction.created_at.isoformat()
            if hasattr(interaction.created_at, "isoformat") and interaction.created_at
            else str(interaction.created_at or datetime.utcnow().isoformat())
        ),
    }
    existing: List[Any] = []
    if pipeline.ai_interactions:
        if isinstance(pipeline.ai_interactions, list):
            existing = list(pipeline.ai_interactions)
        elif isinstance(pipeline.ai_interactions, str):
            try:
                existing = json.loads(pipeline.ai_interactions)
            except json.JSONDecodeError:
                existing = []

    if any(
        isinstance(x, dict) and x.get("interaction_id") == entry["interaction_id"]
        for x in existing
    ):
        return

    existing.append(entry)
    update_sales_pipeline(
        str(pipeline.id),
        SalesPipelineUpdate(ai_interactions=existing[-200:]),
    )


def _maybe_advance_from_customer_sales_stage(
    pipeline: SalesPipeline, customer_sales_stage: Optional[str]
) -> SalesPipeline:
    if not customer_sales_stage:
        return pipeline
    target = CRM_SALES_STAGE_TO_PIPELINE.get(str(customer_sales_stage).strip())
    if not target or target == pipeline.stage:
        return pipeline
    if _stage_rank(target) <= _stage_rank(pipeline.stage):
        return pipeline
    try:
        return update_sales_pipeline(
            str(pipeline.id),
            SalesPipelineUpdate(
                stage=target,
                reason_for_stage_change=(
                    f"Synced from CRM customer sales_stage {customer_sales_stage}"
                ),
                metadata={
                    **(pipeline.metadata or {}),
                    "synced_from_crm_sales_stage": str(customer_sales_stage),
                    "synced_at": datetime.utcnow().isoformat(),
                },
            ),
        )
    except Exception as e:
        logger.debug("CRM sales_stage sync skipped for %s: %s", pipeline.id, e)
        return pipeline


def sync_interaction_to_sales_pipeline(
    interaction: Interaction,
    *,
    use_ai: bool = True,
) -> Optional[str]:
    """
    Link a CRM interaction to the best-matching pipeline and refresh pipeline state.
    Returns pipeline_id when linked.
    """
    pipeline = _resolve_pipeline_for_interaction(interaction)
    if not pipeline:
        return None

    pipeline_id = str(pipeline.id)
    if not interaction.pipeline_id:
        try:
            _link_interaction_to_pipeline(str(interaction.id), pipeline_id)
        except Exception as e:
            logger.warning("Failed to link interaction %s: %s", interaction.id, e)

    try:
        _append_crm_snapshot_to_pipeline(pipeline, interaction)
    except Exception as e:
        logger.warning("Failed to append CRM snapshot on %s: %s", pipeline_id, e)

    text = _interaction_body(interaction)
    if text:
        hint = _heuristic_stage_from_text(text)
        refreshed = get_sales_pipeline_by_id(pipeline_id) or pipeline
        if hint and _stage_rank(hint) > _stage_rank(refreshed.stage):
            try:
                refreshed = update_sales_pipeline(
                    pipeline_id,
                    SalesPipelineUpdate(
                        stage=hint,
                        reason_for_stage_change="Synced from CRM interaction (automatic)",
                        metadata={
                            **(refreshed.metadata or {}),
                            "last_crm_sync_reason": "keyword_match",
                            "synced_at": datetime.utcnow().isoformat(),
                        },
                    ),
                )
            except Exception as e:
                logger.debug("Heuristic stage advance skipped: %s", e)

        if use_ai:
            try:
                from app.services.crm_service import get_customer_by_id

                customer = get_customer_by_id(str(interaction.customer_id))
                customer_name = customer.customer_name if customer else None
                auto_advance_pipeline_stage(
                    pipeline_id=pipeline_id,
                    interaction_text=text[:8000],
                    customer_name=customer_name,
                )
            except Exception as e:
                logger.debug("AI pipeline advance skipped: %s", e)

    try:
        from app.services.crm_service import get_customer_by_id

        customer = get_customer_by_id(str(interaction.customer_id))
        refreshed = get_sales_pipeline_by_id(pipeline_id)
        if refreshed and customer:
            _maybe_advance_from_customer_sales_stage(
                refreshed, customer.sales_stage
            )
    except Exception as e:
        logger.debug("Customer sales_stage sync skipped: %s", e)

    return pipeline_id


def get_interactions_for_pipeline(
    pipeline_id: str,
    limit: int = 100,
) -> List[Dict[str, Any]]:
    """Interactions linked to this pipeline or matching customer+TDS."""
    pipeline = get_sales_pipeline_by_id(pipeline_id)
    if not pipeline:
        return []

    supabase = get_supabase_client()
    seen: set[str] = set()
    rows: List[Dict[str, Any]] = []

    def add_rows(data: List[dict]) -> None:
        for row in data or []:
            rid = str(row.get("id", ""))
            if rid and rid not in seen:
                seen.add(rid)
                rows.append(row)

    res = (
        supabase.table("interactions")
        .select("*")
        .eq("pipeline_id", pipeline_id)
        .order("created_at", desc=True)
        .limit(limit)
        .execute()
    )
    add_rows(res.data or [])

    q = (
        supabase.table("interactions")
        .select("*")
        .eq("customer_id", str(pipeline.customer_id))
        .order("created_at", desc=True)
        .limit(limit)
    )
    if pipeline.tds_id:
        q = q.eq("tds_id", str(pipeline.tds_id))
    res2 = q.execute()
    add_rows(res2.data or [])

    rows.sort(key=lambda r: r.get("created_at") or "", reverse=True)
    return rows[:limit]


def backfill_pipelines_from_customer_interactions(
    customer_id: str,
    *,
    use_ai: bool = False,
) -> Dict[str, Any]:
    """Process all CRM interactions chronologically and sync to sales_pipeline."""
    from app.services.crm_service import get_all_interactions_for_customer

    interactions = get_all_interactions_for_customer(customer_id)
    interactions_sorted = sorted(
        interactions,
        key=lambda i: (i.created_at or datetime.min),
    )

    linked = 0
    pipelines_touched: set[str] = set()

    for interaction in interactions_sorted:
        pid = sync_interaction_to_sales_pipeline(interaction, use_ai=use_ai)
        if pid:
            linked += 1
            pipelines_touched.add(pid)

    return {
        "customer_id": customer_id,
        "interactions_processed": len(interactions_sorted),
        "interactions_linked": linked,
        "pipelines_updated": len(pipelines_touched),
    }
