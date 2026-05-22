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

# Brian Tracy CRM stages (customers.sales_stage 1–7) → sales pipeline board stages
CRM_SALES_STAGE_TO_PIPELINE: Dict[str, str] = {
    "1": "Lead ID",
    "2": "Discovery",
    "3": "Sample",
    "4": "Validation",
    "5": "Proposal",
    "6": "Confirmation",
    "7": "Closed",
}

CRM_STAGE_NAMES: Dict[str, str] = {
    "1": "Prospecting",
    "2": "Rapport",
    "3": "Needs Analysis",
    "4": "Presenting Solution",
    "5": "Handling Objections",
    "6": "Closing",
    "7": "Follow-up & Cross-sell",
}

_STAGE_ORDER = [x for x in PIPELINE_STAGES if x != "Lost"]
_STAGE_INDEX = {s: i for i, s in enumerate(_STAGE_ORDER)}


def normalize_crm_sales_stage(value: Any) -> Optional[str]:
    """Return CRM stage key '1'–'7' from numeric or Brian Tracy label."""
    if value is None:
        return None
    s = str(value).strip()
    if s in CRM_SALES_STAGE_TO_PIPELINE:
        return s
    try:
        n = int(float(s))
        if 1 <= n <= 7:
            return str(n)
    except (TypeError, ValueError):
        pass
    lower = s.lower()
    for num, name in CRM_STAGE_NAMES.items():
        if name.lower() == lower or lower in name.lower():
            return num
    return None


def pipeline_stage_from_crm_sales_stage(value: Any) -> Optional[str]:
    key = normalize_crm_sales_stage(value)
    if not key:
        return None
    return CRM_SALES_STAGE_TO_PIPELINE.get(key)


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
    """Pick or create one deal (customer + product). Never attach to the wrong product."""
    if interaction.pipeline_id:
        existing = get_sales_pipeline_by_id(str(interaction.pipeline_id))
        if existing:
            return existing

    customer_id = str(interaction.customer_id)
    tds_id = str(interaction.tds_id) if interaction.tds_id else None

    if tds_id:
        from app.services.sales_pipeline_service import get_pipeline_by_customer_and_product

        matched = list_sales_pipelines(
            limit=10,
            offset=0,
            customer_id=customer_id,
            tds_id=tds_id,
            latest_per_deal=True,
        )
        if matched:
            return matched[0]
        existing = get_pipeline_by_customer_and_product(customer_id, tds_id=tds_id)
        if existing:
            return existing
        try:
            body = SalesPipelineCreate(
                customer_id=interaction.customer_id,
                tds_id=interaction.tds_id,
                stage="Lead ID",
            )
            return create_sales_pipeline(body)
        except Exception as e:
            logger.warning(
                "Could not create product pipeline for customer %s: %s",
                customer_id,
                e,
            )
            return None

    deals = list_sales_pipelines(
        limit=50,
        offset=0,
        customer_id=customer_id,
        latest_per_deal=True,
    )
    if len(deals) == 1:
        return deals[0]
    if len(deals) == 0:
        try:
            body = SalesPipelineCreate(
                customer_id=interaction.customer_id,
                stage="Lead ID",
            )
            return create_sales_pipeline(body)
        except Exception as e:
            logger.warning(
                "Could not create default pipeline for customer %s: %s",
                customer_id,
                e,
            )
            return None

    logger.info(
        "Interaction %s: %s product deals — link skipped (set tds_id or pipeline_id)",
        interaction.id,
        len(deals),
    )
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


def _advance_pipeline_to_target(
    pipeline: SalesPipeline,
    target: str,
    reason: str,
) -> SalesPipeline:
    """Advance one pipeline stage at a time until target (avoids silent skip failures)."""
    current = pipeline
    guard = 0
    while _stage_rank(current.stage) < _stage_rank(target) and guard < len(_STAGE_ORDER):
        guard += 1
        next_idx = _stage_rank(current.stage) + 1
        if next_idx < 0 or next_idx >= len(_STAGE_ORDER):
            break
        next_stage = _STAGE_ORDER[next_idx]
        if _stage_rank(next_stage) > _stage_rank(target):
            next_stage = target
        try:
            current = update_sales_pipeline(
                str(current.id),
                SalesPipelineUpdate(
                    stage=next_stage,
                    reason_for_stage_change=reason,
                    metadata={
                        **(current.metadata or {}),
                        "synced_at": datetime.utcnow().isoformat(),
                    },
                ),
            )
        except Exception as e:
            logger.warning(
                "Pipeline stage advance %s -> %s failed: %s",
                current.stage,
                next_stage,
                e,
            )
            break
        if current.stage == target:
            break
    return current


def _maybe_advance_from_customer_sales_stage(
    pipeline: SalesPipeline, customer_sales_stage: Optional[str]
) -> SalesPipeline:
    if not customer_sales_stage:
        return pipeline
    target = pipeline_stage_from_crm_sales_stage(customer_sales_stage)
    if not target or target == pipeline.stage:
        return pipeline
    if _stage_rank(target) <= _stage_rank(pipeline.stage):
        return pipeline
    reason = (
        f"Synced from CRM customer sales_stage {customer_sales_stage}"
    )
    try:
        return _advance_pipeline_to_target(pipeline, target, reason)
    except Exception as e:
        logger.warning("CRM sales_stage sync skipped for %s: %s", pipeline.id, e)
        return pipeline


def apply_customer_sales_stage_to_pipelines(customer_id: str) -> Dict[str, Any]:
    """
    Company-level customers.sales_stage is CRM relationship context only.

    Per-product pipeline stages are updated from interactions (per deal), not
    broadcast from this legacy field.
    """
    from app.services.crm_service import get_customer_by_id

    customer = get_customer_by_id(customer_id)
    if not customer:
        return {"customer_id": customer_id, "error": "customer not found", "updated": 0}

    deals = list_sales_pipelines(
        limit=100,
        offset=0,
        customer_id=customer_id,
        latest_per_deal=True,
    )
    return {
        "customer_id": customer_id,
        "sales_stage": customer.sales_stage,
        "product_deals": len(deals),
        "updated": 0,
        "message": "per_product_stages_only",
    }


def sync_interaction_to_sales_pipeline(
    interaction: Interaction,
    *,
    use_ai: bool = True,
    append_snapshot: bool = True,
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

    if append_snapshot:
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


def sync_customer_pipelines_from_crm(
    customer_id: str,
    *,
    use_ai: bool = False,
) -> Dict[str, Any]:
    """Backfill interactions into per-product pipeline deals (stages per deal)."""
    result = backfill_pipelines_from_customer_interactions(
        customer_id, use_ai=use_ai
    )
    result["product_deals"] = apply_customer_sales_stage_to_pipelines(customer_id)
    return result


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
        pid = sync_interaction_to_sales_pipeline(
            interaction,
            use_ai=use_ai,
            append_snapshot=use_ai,
        )
        if pid:
            linked += 1
            pipelines_touched.add(pid)

    return {
        "customer_id": customer_id,
        "interactions_processed": len(interactions_sorted),
        "interactions_linked": linked,
        "pipelines_updated": len(pipelines_touched),
    }


def backfill_all_customers_pipelines(
    *,
    use_ai: bool = False,
    limit: int = 25,
    offset: int = 0,
) -> Dict[str, Any]:
    """Backfill sales pipelines for a batch of CRM customers (paginated)."""
    from app.services.crm_service import get_all_customers, get_customers_count

    customers = get_all_customers(limit=limit, offset=offset)
    total_customers = get_customers_count()
    results: List[Dict[str, Any]] = []
    total_linked = 0
    total_stage_updates = 0
    errors = 0

    for customer in customers:
        cid = str(customer.customer_id)
        try:
            row = sync_customer_pipelines_from_crm(cid, use_ai=use_ai)
            results.append(row)
            total_linked += row.get("interactions_linked", 0)
            stage_sync = row.get("crm_stage_sync") or {}
            total_stage_updates += stage_sync.get("updated", 0)
            if row.get("error"):
                errors += 1
        except Exception as e:
            logger.warning("Pipeline backfill failed for %s: %s", cid, e)
            errors += 1
            results.append({"customer_id": cid, "error": str(e)})

    next_offset = offset + len(customers)
    has_more = next_offset < total_customers

    return {
        "customers_processed": len(results),
        "total_interactions_linked": total_linked,
        "total_stage_updates": total_stage_updates,
        "errors": errors,
        "offset": offset,
        "limit": limit,
        "next_offset": next_offset,
        "total_customers": total_customers,
        "has_more": has_more,
        "results": results,
    }
