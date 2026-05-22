"""
Sync CRM, PMS (TDS/products), and sales_pipeline automatically.

- New customers get a Lead ID deal on the sales pipeline board
- Each interaction links to the matching product deal (tds_id / pipeline_id)
- Interaction updates refresh pipeline snapshots and can advance stage
- Per-product stages are independent (company sales_stage is informational only)
"""

from __future__ import annotations

import json
import logging
from collections import defaultdict
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple, Union
from uuid import UUID

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

# Bulk sync must finish within Vercel's ~60s limit (gateway may 504 earlier).
BACKFILL_BATCH_DEFAULT = 8
BACKFILL_BATCH_MAX = 15
BACKFILL_MAX_INTERACTIONS_PER_CUSTOMER = 250
BACKFILL_LINK_CHUNK_SIZE = 40

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


def _coerce_uuid(value: Union[str, UUID]) -> UUID:
    return value if isinstance(value, UUID) else UUID(str(value))


def _general_company_deal(deals: List[SalesPipeline]) -> Optional[SalesPipeline]:
    """Company umbrella deal with no specific PMS product attached."""
    for pipeline in deals:
        if not pipeline.tds_id and not pipeline.chemical_type_id:
            return pipeline
    return None


def _pick_default_deal_for_orphan_interaction(
    deals: List[SalesPipeline],
) -> Optional[SalesPipeline]:
    """
    When an interaction has no tds_id/pipeline_id but the customer has several deals,
    attach to the best current deal (prefer Closed/Confirmation, then current version).
    """
    if not deals:
        return None
    general = _general_company_deal(deals)
    if general:
        return general

    def score(pipeline: SalesPipeline) -> float:
        rank = float(_stage_rank(pipeline.stage or ""))
        if pipeline.is_current_version:
            rank += 10.0
        return rank

    return max(deals, key=score)


def _pipeline_create_body(
    customer_id: Union[str, UUID],
    *,
    tds_id: Optional[Union[str, UUID]] = None,
    chemical_type_id: Optional[Union[str, UUID]] = None,
    stage: str = "Lead ID",
    metadata: Optional[Dict[str, Any]] = None,
) -> SalesPipelineCreate:
    """Build a pipeline row linked to CRM customer and optional PMS product."""
    cid = _coerce_uuid(customer_id)
    meta = {
        "source": "crm_auto_sync",
        "synced_at": datetime.utcnow().isoformat(),
        **(metadata or {}),
    }
    resolved_chemical = chemical_type_id
    resolved_tds = tds_id

    if tds_id and not resolved_chemical:
        try:
            from app.services.pms_service import get_tds_by_id

            tds = get_tds_by_id(str(tds_id))
            if tds and tds.chemical_type_id:
                resolved_chemical = tds.chemical_type_id
        except Exception as e:
            logger.debug("TDS lookup for pipeline link skipped: %s", e)

    return SalesPipelineCreate(
        customer_id=cid,
        tds_id=_coerce_uuid(resolved_tds) if resolved_tds else None,
        chemical_type_id=_coerce_uuid(resolved_chemical) if resolved_chemical else None,
        stage=stage,
        metadata=meta,
    )


def ensure_lead_pipeline_for_product(
    customer_id: str,
    *,
    tds_id: Optional[Union[str, UUID]] = None,
    chemical_type_id: Optional[Union[str, UUID]] = None,
    metadata: Optional[Dict[str, Any]] = None,
) -> Optional[SalesPipeline]:
    """
    Ensure one Lead ID deal exists for this company + product (or company umbrella when no product).
    Does not change stage if the deal already exists.
    """
    deals = list_sales_pipelines(
        limit=100,
        offset=0,
        customer_id=customer_id,
        latest_per_deal=True,
    )
    tds_s = str(tds_id) if tds_id else None
    chem_s = str(chemical_type_id) if chemical_type_id else None

    for pipeline in deals:
        if tds_s:
            if pipeline.tds_id and str(pipeline.tds_id) == tds_s:
                return pipeline
            continue
        if chem_s:
            if pipeline.chemical_type_id and str(pipeline.chemical_type_id) == chem_s:
                return pipeline
            continue
        if not pipeline.tds_id and not pipeline.chemical_type_id:
            return pipeline

    meta = {
        "source": "auto_on_customer_create",
        "synced_at": datetime.utcnow().isoformat(),
        **(metadata or {}),
    }
    if tds_s:
        meta["source"] = "auto_on_product_deal"
    try:
        pipeline = create_sales_pipeline(
            _pipeline_create_body(
                customer_id,
                tds_id=tds_id,
                chemical_type_id=chemical_type_id,
                stage="Lead ID",
                metadata=meta,
            )
        )
        logger.info(
            "Created Lead ID pipeline %s for customer %s (tds=%s)",
            pipeline.id,
            customer_id,
            tds_s or "umbrella",
        )
        return pipeline
    except Exception as e:
        logger.warning(
            "Could not create Lead ID pipeline for customer %s product %s: %s",
            customer_id,
            tds_s or "umbrella",
            e,
        )
        return None


def ensure_lead_pipeline_for_customer(customer_id: str) -> Optional[SalesPipeline]:
    """Company umbrella deal at Lead ID (no product attached)."""
    return ensure_lead_pipeline_for_product(customer_id)


def ensure_company_pipelines_for_customer(customer_id: str) -> Dict[str, Any]:
    """
    One umbrella company row at Lead ID plus one Lead ID deal per product (TDS) seen in CRM.
    Each product keeps its own stage as interactions sync — stages are not shared across products.
    """
    from app.services.crm_service import get_all_interactions_for_customer

    umbrella = ensure_lead_pipeline_for_product(customer_id)
    tds_ids: set[str] = set()
    for interaction in get_all_interactions_for_customer(
        customer_id, max_rows=500
    ):
        if interaction.tds_id:
            tds_ids.add(str(interaction.tds_id))

    product_pipeline_ids: List[str] = []
    for tds_id in sorted(tds_ids):
        deal = ensure_lead_pipeline_for_product(customer_id, tds_id=tds_id)
        if deal:
            product_pipeline_ids.append(str(deal.id))

    return {
        "customer_id": customer_id,
        "umbrella_pipeline_id": str(umbrella.id) if umbrella else None,
        "product_deal_count": len(product_pipeline_ids),
        "product_pipeline_ids": product_pipeline_ids,
    }


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
        return ensure_lead_pipeline_for_product(
            customer_id,
            tds_id=interaction.tds_id,
            metadata={"source": "auto_on_interaction_tds"},
        )

    deals = list_sales_pipelines(
        limit=50,
        offset=0,
        customer_id=customer_id,
        latest_per_deal=True,
    )
    general = _general_company_deal(deals)
    if general:
        return general
    if len(deals) == 1:
        return deals[0]
    if len(deals) == 0:
        return ensure_lead_pipeline_for_product(
            customer_id,
            metadata={"source": "auto_on_interaction"},
        )

    picked = _pick_default_deal_for_orphan_interaction(deals)
    if picked:
        logger.info(
            "Interaction %s: %s product deals — linked to default deal %s (%s)",
            interaction.id,
            len(deals),
            picked.id,
            picked.stage,
        )
        return picked
    return None


def _link_interaction_to_pipeline(interaction_id: str, pipeline_id: str) -> None:
    supabase = get_supabase_client()
    supabase.table("interactions").update({"pipeline_id": pipeline_id}).eq(
        "id", interaction_id
    ).execute()


def _batch_link_interactions_to_pipelines(
    links: List[Tuple[str, str]],
    *,
    chunk_size: int = BACKFILL_LINK_CHUNK_SIZE,
) -> int:
    """Apply pipeline_id to many interactions (grouped by pipeline, chunked)."""
    if not links:
        return 0
    by_pipeline: Dict[str, List[str]] = defaultdict(list)
    for interaction_id, pipeline_id in links:
        by_pipeline[pipeline_id].append(interaction_id)

    supabase = get_supabase_client()
    linked = 0
    for pipeline_id, interaction_ids in by_pipeline.items():
        unique_ids = list(dict.fromkeys(interaction_ids))
        for i in range(0, len(unique_ids), chunk_size):
            chunk = unique_ids[i : i + chunk_size]
            try:
                supabase.table("interactions").update({"pipeline_id": pipeline_id}).in_(
                    "id", chunk
                ).execute()
                linked += len(chunk)
            except Exception as e:
                logger.warning(
                    "Batch link %s interactions -> pipeline %s failed: %s",
                    len(chunk),
                    pipeline_id,
                    e,
                )
    return linked


def _deal_cache_key(customer_id: str, tds_id: Optional[str]) -> str:
    return f"{customer_id}:{tds_id or '__general__'}"


def _resolve_pipeline_for_interaction_cached(
    interaction: Interaction,
    deals: List[SalesPipeline],
    cache: Dict[str, SalesPipeline],
) -> Optional[SalesPipeline]:
    """Resolve deal using in-memory cache (avoids repeated list_sales_pipelines calls)."""
    if interaction.pipeline_id:
        pid = str(interaction.pipeline_id)
        cached = cache.get(f"pid:{pid}")
        if cached:
            return cached
        existing = get_sales_pipeline_by_id(pid)
        if existing:
            cache[f"pid:{pid}"] = existing
            return existing

    customer_id = str(interaction.customer_id)
    tds_id = str(interaction.tds_id) if interaction.tds_id else None
    key = _deal_cache_key(customer_id, tds_id)
    if key in cache:
        return cache[key]

    if tds_id:
        for pipeline in deals:
            if pipeline.tds_id and str(pipeline.tds_id) == tds_id:
                cache[key] = pipeline
                return pipeline
        created = ensure_lead_pipeline_for_product(
            customer_id,
            tds_id=interaction.tds_id,
            metadata={"source": "auto_on_interaction_tds"},
        )
        if created:
            deals.append(created)
            cache[key] = created
            return created
        return None

    general = _general_company_deal(deals)
    if general:
        cache[_deal_cache_key(customer_id, None)] = general
        return general
    if len(deals) == 1:
        cache[_deal_cache_key(customer_id, None)] = deals[0]
        return deals[0]
    if len(deals) == 0:
        created = ensure_lead_pipeline_for_product(
            customer_id,
            metadata={"source": "auto_on_interaction"},
        )
        if created:
            deals.append(created)
            cache[_deal_cache_key(customer_id, None)] = created
            return created
        return None

    picked = _pick_default_deal_for_orphan_interaction(deals)
    if picked:
        cache[_deal_cache_key(customer_id, None)] = picked
        return picked
    return None


def _upsert_crm_snapshot_to_pipeline(
    pipeline: SalesPipeline, interaction: Interaction
) -> None:
    """Mirror CRM interaction text onto the pipeline deal (insert or refresh on edit)."""
    entry: Dict[str, Any] = {
        "source": "crm",
        "interaction_id": str(interaction.id),
        "tds_id": str(interaction.tds_id) if interaction.tds_id else None,
        "pipeline_id": str(interaction.pipeline_id) if interaction.pipeline_id else None,
        "input_text": (interaction.input_text or "")[:4000],
        "ai_response": (interaction.ai_response or "")[:4000],
        "updated_at": datetime.utcnow().isoformat(),
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

    replaced = False
    for idx, item in enumerate(existing):
        if isinstance(item, dict) and item.get("interaction_id") == entry["interaction_id"]:
            existing[idx] = entry
            replaced = True
            break
    if not replaced:
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
            _upsert_crm_snapshot_to_pipeline(pipeline, interaction)
        except Exception as e:
            logger.warning("Failed to upsert CRM snapshot on %s: %s", pipeline_id, e)

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


def relocate_interactions_to_pipeline_version(
    old_pipeline_id: str,
    new_pipeline_id: str,
) -> int:
    """Move interaction links when a deal gets a new pipeline version (e.g. Closed)."""
    if not old_pipeline_id or not new_pipeline_id or old_pipeline_id == new_pipeline_id:
        return 0
    supabase = get_supabase_client()
    try:
        res = (
            supabase.table("interactions")
            .update({"pipeline_id": new_pipeline_id})
            .eq("pipeline_id", old_pipeline_id)
            .execute()
        )
        return len(res.data or [])
    except Exception as e:
        logger.warning(
            "Failed to relocate interactions %s -> %s: %s",
            old_pipeline_id,
            new_pipeline_id,
            e,
        )
        return 0


def _pipeline_version_ids(pipeline_id: str) -> List[str]:
    from app.services.sales_pipeline_service import get_pipeline_versions

    versions = get_pipeline_versions(pipeline_id)
    if versions:
        return [str(v.id) for v in versions]
    return [pipeline_id]


def _product_ids_for_pipeline(pipeline: SalesPipeline) -> List[str]:
    ids: List[str] = []
    if pipeline.tds_id:
        ids.append(str(pipeline.tds_id))
    if pipeline.chemical_type_id:
        cid = str(pipeline.chemical_type_id)
        if cid not in ids:
            ids.append(cid)
    return ids


def _interaction_matches_product(
    row: Dict[str, Any],
    product_ids: List[str],
) -> bool:
    if not product_ids:
        return True
    row_tds = row.get("tds_id")
    if row_tds is None:
        return True
    return str(row_tds) in product_ids


def _ai_interaction_rows_from_pipeline(
    pipeline: SalesPipeline,
    *,
    seen: set[str],
) -> List[Dict[str, Any]]:
    """CRM snapshots stored on sales_pipeline.ai_interactions (not always in interactions table)."""
    raw = pipeline.ai_interactions
    if isinstance(raw, str):
        try:
            entries = json.loads(raw)
        except json.JSONDecodeError:
            entries = []
    elif isinstance(raw, list):
        entries = raw
    else:
        entries = []

    rows: List[Dict[str, Any]] = []
    for entry in entries:
        if not isinstance(entry, dict):
            continue
        iid = entry.get("interaction_id")
        if iid and str(iid) in seen:
            continue
        input_text = (entry.get("input_text") or entry.get("user_input") or "").strip()
        ai_response = (entry.get("ai_response") or "").strip()
        if not input_text and not ai_response:
            continue
        synthetic_id = iid or f"pipeline-ai-{pipeline.id}-{entry.get('created_at', '')}"
        if str(synthetic_id) in seen:
            continue
        seen.add(str(synthetic_id))
        rows.append(
            {
                "id": synthetic_id,
                "customer_id": str(pipeline.customer_id),
                "pipeline_id": str(pipeline.id),
                "tds_id": entry.get("tds_id") or (
                    str(pipeline.tds_id) if pipeline.tds_id else None
                ),
                "input_text": input_text or None,
                "ai_response": ai_response or None,
                "created_at": entry.get("created_at") or entry.get("timestamp"),
                "history_source": "pipeline",
            }
        )
    return rows


def get_interactions_for_pipeline(
    pipeline_id: str,
    limit: int = 100,
) -> List[Dict[str, Any]]:
    """Interactions for this deal: all versions, customer+product match, and pipeline JSON."""
    pipeline = get_sales_pipeline_by_id(pipeline_id)
    if not pipeline:
        return []

    supabase = get_supabase_client()
    seen: set[str] = set()
    rows: List[Dict[str, Any]] = []
    product_ids = _product_ids_for_pipeline(pipeline)

    def add_rows(data: List[dict], *, filter_product: bool = False) -> None:
        for row in data or []:
            if filter_product and not _interaction_matches_product(row, product_ids):
                continue
            rid = str(row.get("id", ""))
            if rid and rid not in seen:
                seen.add(rid)
                rows.append(row)

    for vid in _pipeline_version_ids(pipeline_id):
        res = (
            supabase.table("interactions")
            .select("*")
            .eq("pipeline_id", vid)
            .order("created_at", desc=True)
            .limit(limit)
            .execute()
        )
        add_rows(res.data or [])

    cust_res = (
        supabase.table("interactions")
        .select("*")
        .eq("customer_id", str(pipeline.customer_id))
        .order("created_at", desc=True)
        .limit(limit * 2)
        .execute()
    )
    add_rows(cust_res.data or [], filter_product=bool(product_ids))

    current = get_sales_pipeline_by_id(pipeline_id) or pipeline
    rows.extend(_ai_interaction_rows_from_pipeline(current, seen=seen))

    rows.sort(key=lambda r: r.get("created_at") or "", reverse=True)
    return rows[:limit]


def sync_customer_pipelines_from_crm(
    customer_id: str,
    *,
    use_ai: bool = False,
    fast: bool = True,
) -> Dict[str, Any]:
    """Backfill interactions into per-product pipeline deals (stages per deal)."""
    bootstrap = ensure_company_pipelines_for_customer(customer_id)
    result = backfill_pipelines_from_customer_interactions(
        customer_id, use_ai=use_ai, fast=fast
    )
    result["company_pipelines"] = bootstrap
    result["product_deals"] = apply_customer_sales_stage_to_pipelines(customer_id)
    return result


def backfill_pipelines_from_customer_interactions(
    customer_id: str,
    *,
    use_ai: bool = False,
    fast: bool = True,
    max_interactions: int = BACKFILL_MAX_INTERACTIONS_PER_CUSTOMER,
) -> Dict[str, Any]:
    """Process CRM interactions and link them to sales_pipeline deals."""
    from app.services.crm_service import get_all_interactions_for_customer

    interactions = get_all_interactions_for_customer(
        customer_id, max_rows=max_interactions
    )
    interactions_sorted = sorted(
        interactions,
        key=lambda i: (i.created_at or datetime.min),
    )
    capped = len(interactions) >= max_interactions

    if fast and not use_ai:
        deals = list_sales_pipelines(
            limit=100,
            offset=0,
            customer_id=customer_id,
            latest_per_deal=True,
        )
        cache: Dict[str, SalesPipeline] = {}
        pipelines_touched: set[str] = set()
        pending_links: List[Tuple[str, str]] = []

        for interaction in interactions_sorted:
            pipeline = _resolve_pipeline_for_interaction_cached(
                interaction, deals, cache
            )
            if not pipeline:
                continue
            pid = str(pipeline.id)
            pipelines_touched.add(pid)
            if not interaction.pipeline_id or str(interaction.pipeline_id) != pid:
                pending_links.append((str(interaction.id), pid))

        linked = _batch_link_interactions_to_pipelines(pending_links)
        snapshots = 0
        for interaction in interactions_sorted:
            pipeline = _resolve_pipeline_for_interaction_cached(
                interaction, deals, cache
            )
            if not pipeline:
                continue
            try:
                refreshed = get_sales_pipeline_by_id(str(pipeline.id)) or pipeline
                _upsert_crm_snapshot_to_pipeline(refreshed, interaction)
                snapshots += 1
            except Exception as e:
                logger.debug("Fast snapshot upsert skipped for %s: %s", interaction.id, e)

        return {
            "customer_id": customer_id,
            "interactions_processed": len(interactions_sorted),
            "interactions_linked": linked,
            "pipelines_updated": len(pipelines_touched),
            "snapshots_upserted": snapshots,
            "fast_mode": True,
            "interactions_capped": capped,
        }

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
        "fast_mode": False,
        "interactions_capped": capped,
    }


def relink_stale_interactions_to_current_deals(
    customer_id: Optional[str] = None,
    *,
    limit: int = 500,
) -> Dict[str, Any]:
    """
    Point interactions at the current pipeline version when they still reference
    an older version (common after moving a deal to Closed).
    """
    from app.services.sales_pipeline_service import (
        _pick_better_pipeline,
        normalize_pipeline_row_from_db,
    )

    supabase = get_supabase_client()
    query = supabase.table("sales_pipeline").select(
        "id, customer_id, tds_id, chemical_type_id, stage, is_current_version, "
        "parent_pipeline_id, version_number, updated_at, created_at, ai_interactions"
    )
    if customer_id:
        query = query.eq("customer_id", customer_id)
    resp = query.limit(limit).execute()
    pipelines = resp.data or []

    by_root: Dict[str, SalesPipeline] = {}
    for row in pipelines:
        try:
            pipeline = SalesPipeline(**normalize_pipeline_row_from_db(row))
        except Exception:
            continue
        root = str(pipeline.parent_pipeline_id or pipeline.id)
        prev = by_root.get(root)
        if not prev:
            by_root[root] = pipeline
            continue
        by_root[root] = _pick_better_pipeline(prev, pipeline)

    stale_to_current: Dict[str, str] = {}
    for current in by_root.values():
        for vid in _pipeline_version_ids(str(current.id)):
            if vid != str(current.id):
                stale_to_current[vid] = str(current.id)

    relinked = 0
    for old_id, new_id in stale_to_current.items():
        relinked += relocate_interactions_to_pipeline_version(old_id, new_id)

    return {
        "customer_id": customer_id,
        "current_deals": len(by_root),
        "stale_pipeline_ids": len(stale_to_current),
        "interactions_relinked": relinked,
    }


def backfill_all_customers_pipelines(
    *,
    use_ai: bool = False,
    fast: bool = True,
    limit: int = BACKFILL_BATCH_DEFAULT,
    offset: int = 0,
    include_results: bool = False,
) -> Dict[str, Any]:
    """Backfill sales pipelines for a batch of CRM customers (paginated, serverless-safe)."""
    from app.services.crm_service import get_all_customers, get_customers_count

    batch_limit = min(max(1, limit), BACKFILL_BATCH_MAX)
    customers = get_all_customers(limit=batch_limit, offset=offset)
    total_customers = get_customers_count()
    results: List[Dict[str, Any]] = []
    error_details: List[Dict[str, Any]] = []
    total_linked = 0
    total_stage_updates = 0
    errors = 0

    for customer in customers:
        cid = str(customer.customer_id)
        try:
            row = sync_customer_pipelines_from_crm(
                cid, use_ai=use_ai, fast=fast and not use_ai
            )
            if include_results:
                results.append(row)
            total_linked += row.get("interactions_linked", 0)
            stage_sync = row.get("crm_stage_sync") or {}
            total_stage_updates += stage_sync.get("updated", 0)
            if row.get("error"):
                errors += 1
                error_details.append(
                    {"customer_id": cid, "error": row.get("error")}
                )
        except Exception as e:
            logger.warning("Pipeline backfill failed for %s: %s", cid, e)
            errors += 1
            error_details.append({"customer_id": cid, "error": str(e)})
            if include_results:
                results.append({"customer_id": cid, "error": str(e)})

    next_offset = offset + len(customers)
    has_more = next_offset < total_customers

    payload: Dict[str, Any] = {
        "customers_processed": len(customers),
        "total_interactions_linked": total_linked,
        "total_stage_updates": total_stage_updates,
        "errors": errors,
        "offset": offset,
        "limit": batch_limit,
        "next_offset": next_offset,
        "total_customers": total_customers,
        "has_more": has_more,
        "fast_mode": fast and not use_ai,
    }
    if include_results:
        payload["results"] = results
    if error_details:
        payload["error_details"] = error_details
    return payload
