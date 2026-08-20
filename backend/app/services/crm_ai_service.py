"""CRM ICP streaming, Gemini context caching, and history gathering."""

from __future__ import annotations

import json
import logging
import re
from datetime import datetime, timedelta, timezone
from typing import Any, AsyncIterator, Dict, List, Optional, Tuple

from app.database.connection import get_supabase_client, get_supabase_service_client
from app.services.ai_service import (
    gemini_embed,
    get_ai_service,
    log_conversation_to_rag,
)
from app.services.crm_service import (
    create_interaction,
    get_customer_by_id,
    merge_customer_interaction_history,
)
from app.services.pms_service import get_all_categories
from app.services.profile_research_service import (
    PROFILE_CONTEXT_MAX_CHARS,
    build_profile_research_context,
    gather_profile_research_inputs,
)
from app.models.crm import InteractionCreate
from app.utils.profile_text import sanitize_profile_plain_text

logger = logging.getLogger(__name__)

CACHE_MIN_CHARS = 8000
CACHE_TTL = timedelta(hours=1)


def gather_customer_interaction_history(customer_id: str, max_rows: int = 150) -> Dict[str, Any]:
    customer = get_customer_by_id(customer_id)
    if not customer:
        raise ValueError("Customer not found")
    try:
        interactions, table_total, _, pipeline_added, _ = merge_customer_interaction_history(
            str(customer.customer_id),
            max_rows=max_rows,
        )
    except Exception as exc:
        logger.warning("Failed to fetch interactions for %s: %s", customer_id, exc)
        interactions, table_total, pipeline_added = [], 0, 0
    return {
        "customer": customer,
        "interactions": interactions,
        "table_total": table_total,
        "pipeline_added": pipeline_added,
    }


def _history_blob(interactions: List[Any]) -> str:
    lines: List[str] = []
    for item in interactions:
        created = getattr(item, "created_at", None) or ""
        user_text = getattr(item, "input_text", None) or ""
        ai_text = getattr(item, "ai_response", None) or ""
        if isinstance(item, dict):
            created = item.get("created_at") or ""
            user_text = item.get("input_text") or ""
            ai_text = item.get("ai_response") or ""
        chunk = f"[{created}]\nUser: {user_text}\nAI: {ai_text}".strip()
        if chunk:
            lines.append(chunk)
    return "\n\n".join(lines)


def _load_cache_row(customer_id: str) -> Optional[Dict[str, Any]]:
    try:
        resp = (
            get_supabase_service_client()
            .table("ai_context_caches")
            .select("customer_id, gemini_cache_name, expires_at")
            .eq("customer_id", customer_id)
            .limit(1)
            .execute()
        )
        rows = resp.data or []
        return rows[0] if rows else None
    except Exception as exc:
        logger.debug("ai_context_caches read skipped: %s", exc)
        return None


def _save_cache_row(customer_id: str, cache_name: str, expires_at: datetime) -> None:
    payload = {
        "customer_id": customer_id,
        "gemini_cache_name": cache_name,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "expires_at": expires_at.isoformat(),
    }
    try:
        get_supabase_service_client().table("ai_context_caches").upsert(
            payload, on_conflict="customer_id"
        ).execute()
    except Exception as exc:
        logger.warning("Failed to store Gemini cache name: %s", exc)


def _create_gemini_cache(
    *,
    customer_id: str,
    customer_name: str,
    history_text: str,
    system_instruction: str,
) -> Optional[str]:
    if len(history_text or "") < CACHE_MIN_CHARS:
        return None
    service = get_ai_service()
    expires_at = datetime.now(timezone.utc) + CACHE_TTL
    display = f"icp-{customer_id[:8]}-{customer_name[:40]}"

    if service._google_genai_client is not None:
        try:
            from google.genai import types

            created = service._google_genai_client.caches.create(
                model=service.default_gemini_model,
                config=types.CreateCachedContentConfig(
                    display_name=display[:60],
                    system_instruction=system_instruction,
                    contents=[history_text],
                    ttl=f"{int(CACHE_TTL.total_seconds())}s",
                ),
            )
            name = getattr(created, "name", None) or getattr(created, "cache_name", None)
            if name:
                _save_cache_row(customer_id, str(name), expires_at)
                return str(name)
        except Exception as exc:
            logger.info("google.genai cache create failed: %s", exc)

    try:
        import google.generativeai as genai
        from app.services.ai_service import _configure_gemini_legacy

        _configure_gemini_legacy()
        cached = genai.caching.CachedContent.create(
            model=service.default_gemini_model,
            system_instruction=system_instruction,
            contents=[history_text],
            ttl=CACHE_TTL,
            display_name=display[:60],
        )
        name = getattr(cached, "name", None)
        if name:
            _save_cache_row(customer_id, str(name), expires_at)
            return str(name)
    except Exception as exc:
        logger.info("generativeai cache create failed: %s", exc)
    return None


def ensure_interaction_context_cache(
    customer_id: str,
    history_text: str,
    system_instruction: str,
    customer_name: str,
) -> Optional[str]:
    row = _load_cache_row(customer_id)
    if row:
        expires = row.get("expires_at")
        try:
            exp = datetime.fromisoformat(str(expires).replace("Z", "+00:00"))
            if exp.tzinfo is None:
                exp = exp.replace(tzinfo=timezone.utc)
            if exp > datetime.now(timezone.utc) and row.get("gemini_cache_name"):
                return str(row["gemini_cache_name"])
        except Exception:
            pass
    return _create_gemini_cache(
        customer_id=customer_id,
        customer_name=customer_name,
        history_text=history_text,
        system_instruction=system_instruction,
    )


def _category_prompt(categories_list: List[str]) -> Tuple[str, Dict[str, str], str]:
    category_prompt_lines = []
    category_json_keys: Dict[str, str] = {}
    for cat in categories_list:
        json_key = cat.lower().replace(" ", "_").replace("-", "_").replace("&", "and")
        category_json_keys[cat] = json_key
        category_prompt_lines.append(f"- {cat} (0=No Fit, 1=Low Fit, 2=Moderate Fit, 3=High Fit)")
    json_example = json.dumps(
        {"strategic_fit_matrix": {k: "0-3" for k in category_json_keys.values()}},
        indent=2,
    )
    return "\n".join(category_prompt_lines), category_json_keys, json_example


def build_icp_prompts(
    customer_id: str,
    *,
    skip_external_research: bool = False,
    user_id: Optional[str] = None,
) -> Dict[str, Any]:
    bundle = gather_customer_interaction_history(customer_id)
    customer = bundle["customer"]
    interactions = bundle["interactions"]
    research_inputs = gather_profile_research_inputs(
        customer,
        interactions,
        user_id=user_id,
        skip_external_research=skip_external_research,
    )
    context, research_meta = build_profile_research_context(
        customer,
        rag_docs=research_inputs["rag_docs"],
        interactions=research_inputs["interactions"],
        web_context=research_inputs["web_context"],
        linkedin_context=research_inputs["linkedin_context"],
        conversation_logs=None,
    )
    try:
        from app.services.chemical_master_data import get_all_industries

        categories_list = list(
            dict.fromkeys((get_all_categories() or []) + (get_all_industries() or []))
        )
        if not categories_list:
            categories_list = ["Cement", "Dry-Mix", "Admixtures", "Paint & Coatings"]
    except Exception:
        categories_list = ["Cement", "Dry-Mix", "Admixtures", "Paint & Coatings"]

    categories_text, category_json_keys, json_example = _category_prompt(categories_list)
    system_prompt = f"""You are an Industry-Intel Research Assistant and B2B Chemical-Supply Strategist for LeanChem.

Write a thorough Ideal Customer Profile for the target company and every construction-relevant subsidiary in Ethiopia.

LENGTH: Aim for 2,500–3,500 words when the research context is rich.

LeanChem offerings (for fit reasoning):
- Dry-Mix/Plaster: RDP, HPMC, Starch Ether, Fiber, Zinc Stearate, Plasticizer, Defoamer, SBR, Acrylic Waterproofing, White Cement, Iron Oxide, Titanium Dioxide
- Concrete Admixtures: PCE, SNF, Lignosulphonate, Sodium Gluconate, Penetrol-type waterproofing
- Paint/Coatings: Styrene-Acrylic Binders, Pure Acrylics, VAE, HEC, White Cement, Iron Oxide, Titanium Dioxide
- Cement Grinding: cement grinding aids

Strategic-fit categories (score 0–3 each):
{categories_text}

OUTPUT FORMAT (CRITICAL):
- Plain text only: no markdown tables, no ### headers, no **bold**, no fences, no emojis.
- Use numbered sections 0–4: Research Context Summary, Company Snapshot, Construction Footprint in Ethiopia, Strategic Fit Assessment, Recommended Next Steps.

CRITICAL: At the END of your response, include a JSON block with Strategic-Fit Matrix scores:
{json_example}
"""
    user_prompt = (
        f"Generate a profile for: {customer.customer_name}\n\n"
        f"Use every labeled research section below (RAG, CRM, Web, LinkedIn).\n\n"
        f"{context}"
    )
    history_text = _history_blob(interactions)
    return {
        "customer": customer,
        "system_prompt": system_prompt,
        "user_prompt": user_prompt,
        "history_text": history_text,
        "research_meta": research_meta,
        "table_total": bundle["table_total"],
        "pipeline_added": bundle["pipeline_added"],
        "categories_list": categories_list,
        "category_json_keys": category_json_keys,
        "user_id": user_id,
    }


def persist_streamed_icp(
    *,
    customer_id: str,
    raw_profile_text: str,
    research_meta: Dict[str, Any],
    table_total: int,
    pipeline_added: int,
    categories_list: List[str],
    category_json_keys: Dict[str, str],
    user_id: Optional[str] = None,
) -> None:
    customer = get_customer_by_id(customer_id)
    if not customer:
        return
    raw_profile_text = raw_profile_text or ""
    json_match = None
    json_patterns = [
        r'\{[^{}]*"strategic_fit_matrix"[^{}]*\{[^{}]*\}[^{}]*\}',
        r'\{[^}]*"strategic_fit_matrix"[^}]*\}',
    ]
    for pattern in json_patterns:
        json_match = re.search(pattern, raw_profile_text, re.IGNORECASE | re.DOTALL)
        if json_match:
            break
    profile_text = sanitize_profile_plain_text(raw_profile_text)
    product_scores = {cat: 0 for cat in categories_list}
    if json_match:
        try:
            parsed = json.loads(json_match.group(0))
            matrix = parsed.get("strategic_fit_matrix", {})
            product_scores = {}
            for cat in categories_list:
                json_key = category_json_keys.get(cat, cat)
                score = matrix.get(json_key) or matrix.get(cat.lower()) or matrix.get(cat) or 0
                try:
                    product_scores[cat] = max(0, min(3, int(score)))
                except (ValueError, TypeError):
                    product_scores[cat] = 0
        except Exception:
            pass

    research_meta = dict(research_meta or {})
    research_meta["pipeline_archive_count"] = pipeline_added
    research_meta["interactions_table_count"] = table_total
    update_payload: Dict[str, Any] = {
        "product_alignment_scores": product_scores,
        "latest_profile_text": profile_text,
        "latest_profile_updated_at": datetime.utcnow().isoformat(),
        "latest_profile_research_meta": research_meta,
    }
    supabase = get_supabase_client()
    try:
        supabase.table("customers").update(update_payload).eq(
            "customer_id", customer.customer_id
        ).execute()
    except Exception:
        update_payload.pop("latest_profile_research_meta", None)
        supabase.table("customers").update(update_payload).eq(
            "customer_id", customer.customer_id
        ).execute()

    create_interaction(
        customer_id=str(customer.customer_id),
        interaction_in=InteractionCreate(
            input_text=f"System: AI profile generated for {customer.customer_name}",
            ai_response=profile_text,
            tds_id=None,
        ),
        user_id=user_id,
    )
    try:
        combined_text = (
            f"Customer: {customer.customer_name}\n"
            f"AI-generated CRM profile:\n{profile_text}"
        )
        embedding = gemini_embed(combined_text)
        log_conversation_to_rag(
            combined_text,
            embedding=embedding,
            metadata={
                "customer_id": str(customer.customer_id),
                "customer_name": customer.customer_name,
                "source": "customer_profile_stream",
                "user_id": user_id,
            },
        )
    except Exception:
        pass


async def stream_icp_generation(
    customer_id: str,
    *,
    skip_external_research: bool = False,
    user_id: Optional[str] = None,
) -> AsyncIterator[str]:
    """Yield ICP text chunks, then persist the completed profile."""
    packed = build_icp_prompts(
        customer_id,
        skip_external_research=skip_external_research,
        user_id=user_id,
    )
    customer = packed["customer"]
    cache_name = ensure_interaction_context_cache(
        str(customer.customer_id),
        packed["history_text"],
        packed["system_prompt"],
        customer.customer_name,
    )
    user_prompt = packed["user_prompt"]
    system_prompt = packed["system_prompt"]
    if cache_name:
        user_prompt = (
            f"Generate the Ideal Customer Profile for {customer.customer_name} "
            "using the cached CRM interaction history and research instructions."
        )

    collected: List[str] = []
    async for chunk in get_ai_service().stream_text(
        prompt=user_prompt,
        system_instruction="" if cache_name else system_prompt,
        task_type="icp",
        max_tokens=8192,
        cached_content=cache_name,
        timeout_seconds=90.0,
    ):
        collected.append(chunk)
        yield chunk

    raw = "".join(collected)
    if raw.strip():
        persist_streamed_icp(
            customer_id=str(customer.customer_id),
            raw_profile_text=raw,
            research_meta=packed["research_meta"],
            table_total=packed["table_total"],
            pipeline_added=packed["pipeline_added"],
            categories_list=packed["categories_list"],
            category_json_keys=packed["category_json_keys"],
            user_id=user_id,
        )
