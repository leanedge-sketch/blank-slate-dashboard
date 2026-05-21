"""
Assemble rich research context for ICP / customer profile generation.
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional, Tuple

import logging

from app.models.crm import Customer, Interaction
from app.services.ai_service import search_documents_for_profile
from app.services.web_search_service import (
    enrich_web_context_for_profile,
    search_linkedin_profiles_ethiopia,
)

# Budgets for assembled context sent to the model (~120k chars total).
PROFILE_CONTEXT_MAX_CHARS = 120_000
PROFILE_SYSTEM_PROMPT_BUFFER_CHARS = 10_000

PROFILE_MAX_RAG_DOCS = 12
PROFILE_MAX_CHARS_PER_RAG_DOC = 8_000
PROFILE_MAX_INTERACTIONS = 50
PROFILE_MAX_CHARS_PER_INTERACTION = 6_000
PROFILE_MAX_WEB_CHARS = 45_000
PROFILE_MAX_LINKEDIN_CHARS = 35_000

SECTION_BUDGET_SHARE = {
    "customer_record": 0.06,
    "rag": 0.32,
    "crm": 0.30,
    "web": 0.20,
    "linkedin": 0.12,
}


def _truncate_text(text: str, max_chars: int, label: str = "content") -> str:
    cleaned = (text or "").strip()
    if len(cleaned) <= max_chars:
        return cleaned
    suffix = f"\n...[truncated {label}: kept first {max_chars:,} chars]"
    return cleaned[:max_chars] + suffix


def _section_char_budget(total: int, key: str) -> int:
    return max(2_000, int(total * SECTION_BUDGET_SHARE.get(key, 0.1)))


def _format_customer_record(customer: Customer) -> str:
    lines = [
        f"Customer name: {customer.customer_name}",
        f"Display ID: {customer.display_id or '—'}",
        f"Sales stage: {customer.sales_stage or '—'}",
        f"Website URL (CRM): {customer.website_url or '—'}",
        f"LinkedIn company URL (CRM): {customer.linkedin_company_url or '—'}",
        f"Primary contact: {customer.primary_contact_name or '—'}",
        f"Email: {customer.primary_contact_email or '—'}",
        f"Phone: {customer.primary_contact_phone or '—'}",
    ]
    return "\n".join(lines)


def _gather_rag_documents(
    customer: Customer,
    interactions: List[Interaction],
    *,
    user_id: Optional[str] = None,
) -> List[Dict[str, Any]]:
    queries: List[str] = [
        customer.customer_name,
        f"{customer.customer_name} Ethiopia construction cement dry-mix admixtures",
        f"{customer.customer_name} B2B chemical supply LeanChem",
    ]
    if interactions:
        latest = interactions[0]
        snippet = " ".join(
            filter(
                None,
                [
                    (latest.input_text or "")[:200],
                    (latest.ai_response or "")[:200],
                ],
            )
        ).strip()
        if snippet:
            queries.append(f"{customer.customer_name} {snippet}")

    seen: set[str] = set()
    collected: List[Dict[str, Any]] = []
    per_query_limit = max(4, PROFILE_MAX_RAG_DOCS // len(queries))

    for query in queries:
        try:
            matches = search_documents_for_profile(
                query, user_id=user_id, limit=per_query_limit
            )
        except Exception as exc:
            logging.warning("RAG search failed for '%s': %s", query, exc)
            matches = []
        for doc in matches:
            content = (doc.get("content") or "").strip()
            if not content:
                continue
            key = content[:300]
            if key in seen:
                continue
            seen.add(key)
            collected.append(doc)
        if len(collected) >= PROFILE_MAX_RAG_DOCS:
            break

    return collected[:PROFILE_MAX_RAG_DOCS]


def _format_rag_section(docs: List[Dict[str, Any]], char_budget: int) -> Tuple[str, Dict[str, Any]]:
    if not docs:
        body = "No RAG documents matched this customer in the conversation index.\n"
        return (
            "=== RAG DOCUMENTS (0 snippets) ===\n" + body,
            {"rag_document_count": 0, "rag_chars": len(body), "rag_truncated": False},
        )

    parts: List[str] = [f"=== RAG DOCUMENTS ({len(docs)} snippets) ===\n"]
    per_doc = max(1_500, char_budget // max(1, len(docs)))
    truncated_any = False

    for idx, doc in enumerate(docs, start=1):
        content = _truncate_text(
            doc.get("content", "") or "",
            min(PROFILE_MAX_CHARS_PER_RAG_DOC, per_doc),
            f"RAG document {idx}",
        )
        if len((doc.get("content") or "")) > len(content):
            truncated_any = True
        meta = doc.get("metadata") or {}
        meta_bits = []
        if meta.get("source"):
            meta_bits.append(f"source={meta['source']}")
        if meta.get("customer_name"):
            meta_bits.append(f"customer={meta['customer_name']}")
        if meta.get("customer_id"):
            meta_bits.append(f"customer_id={meta['customer_id']}")
        if doc.get("similarity") is not None:
            meta_bits.append(f"similarity={doc['similarity']:.3f}")

        header = f"--- RAG document {idx} of {len(docs)}"
        if meta_bits:
            header += f" ({', '.join(meta_bits)})"
        header += " ---\n"
        parts.append(header + content + "\n")

    body = "\n".join(parts)
    body = _truncate_text(body, char_budget, "RAG section")
    return body, {
        "rag_document_count": len(docs),
        "rag_chars": len(body),
        "rag_truncated": truncated_any or len(body) >= char_budget - 50,
    }


def _format_crm_section(
    interactions: List[Interaction], char_budget: int
) -> Tuple[str, Dict[str, Any]]:
    if not interactions:
        body = "No CRM interactions recorded for this customer yet.\n"
        return (
            "=== CRM INTERACTIONS (0) ===\n" + body,
            {"crm_interaction_count": 0, "crm_chars": len(body), "crm_truncated": False},
        )

    count = min(len(interactions), PROFILE_MAX_INTERACTIONS)
    parts: List[str] = [f"=== CRM INTERACTIONS ({count} logs, newest first) ===\n"]
    per_item = max(800, char_budget // max(1, count))
    truncated_any = False

    for inter in interactions[:PROFILE_MAX_INTERACTIONS]:
        ts = getattr(inter, "created_at", None)
        ts_str = ts.isoformat() if ts else "unknown_time"
        note_budget = per_item // 2
        resp_budget = per_item - note_budget
        input_text = _truncate_text(
            (inter.input_text or "").strip(),
            note_budget,
            "interaction note",
        )
        ai_resp = _truncate_text(
            (inter.ai_response or "").strip(),
            resp_budget,
            "interaction response",
        )
        if len((inter.input_text or "")) > len(input_text) or len(
            (inter.ai_response or "")
        ) > len(ai_resp):
            truncated_any = True
        block = f"\n[Interaction at {ts_str}]\n"
        if input_text:
            block += f"Sales/Customer note: {input_text}\n"
        if ai_resp:
            block += f"AI response/summary: {ai_resp}\n"
        parts.append(_truncate_text(block, per_item, "interaction log"))

    body = "\n".join(parts)
    body = _truncate_text(body, char_budget, "CRM section")
    return body, {
        "crm_interaction_count": count,
        "crm_chars": len(body),
        "crm_truncated": truncated_any or len(body) >= char_budget - 50,
    }


def _format_web_section(web_context: str, char_budget: int) -> Tuple[str, Dict[str, Any]]:
    if not (web_context or "").strip():
        body = "Web search returned no results (check GOOGLE_PSE_API_KEY / SERPAPI_API_KEY).\n"
        return (
            "=== WEB SEARCH ===\n" + body,
            {
                "web_search_available": False,
                "web_search_chars": len(body),
                "web_truncated": False,
            },
        )

    body = "=== WEB SEARCH ===\n" + _truncate_text(
        web_context,
        min(PROFILE_MAX_WEB_CHARS, char_budget),
        "web search",
    )
    meta = {
        "web_search_available": True,
        "web_search_chars": len(body),
        "web_truncated": len(web_context) > len(body) - 30,
    }
    return body, meta


def _format_linkedin_section(
    linkedin_context: str, char_budget: int
) -> Tuple[str, Dict[str, Any]]:
    if not (linkedin_context or "").strip():
        body = "LinkedIn search returned no profiles.\n"
        return (
            "=== LINKEDIN ===\n" + body,
            {
                "linkedin_available": False,
                "linkedin_chars": len(body),
                "linkedin_truncated": False,
            },
        )

    body = "=== LINKEDIN ===\n" + _truncate_text(
        linkedin_context,
        min(PROFILE_MAX_LINKEDIN_CHARS, char_budget),
        "LinkedIn",
    )
    meta = {
        "linkedin_available": True,
        "linkedin_chars": len(body),
        "linkedin_truncated": len(linkedin_context) > len(body) - 30,
    }
    return body, meta


def gather_profile_research_inputs(
    customer: Customer,
    interactions: List[Interaction],
    *,
    user_id: Optional[str] = None,
) -> Dict[str, Any]:
    """Fetch RAG, web, and LinkedIn inputs (CRM interactions passed in)."""
    rag_docs = _gather_rag_documents(customer, interactions, user_id=user_id)

    try:
        web_context = enrich_web_context_for_profile(
            customer.customer_name,
            website_url=customer.website_url,
        )
    except Exception as exc:
        logging.warning("Web search failed: %s", exc)
        web_context = ""

    try:
        linkedin_context = search_linkedin_profiles_ethiopia(
            customer.customer_name,
            company_linkedin_url=customer.linkedin_company_url,
            max_profiles=20,
        )
    except Exception as exc:
        logging.warning("LinkedIn search failed: %s", exc)
        linkedin_context = ""

    return {
        "rag_docs": rag_docs,
        "interactions": interactions,
        "web_context": web_context,
        "linkedin_context": linkedin_context,
    }


def build_profile_research_context(
    customer: Customer,
    *,
    rag_docs: List[Dict[str, Any]],
    interactions: List[Interaction],
    web_context: str,
    linkedin_context: str,
) -> Tuple[str, Dict[str, Any]]:
    """
    Assemble labeled research sections with per-source budgets.
    Returns (context_text, metadata for UI and logging).
    """
    total_budget = PROFILE_CONTEXT_MAX_CHARS
    customer_section = _truncate_text(
        _format_customer_record(customer),
        _section_char_budget(total_budget, "customer_record"),
        "customer record",
    )

    rag_section, rag_meta = _format_rag_section(
        rag_docs, _section_char_budget(total_budget, "rag")
    )
    crm_section, crm_meta = _format_crm_section(
        interactions, _section_char_budget(total_budget, "crm")
    )
    web_section, web_meta = _format_web_section(
        web_context, _section_char_budget(total_budget, "web")
    )
    linkedin_section, linkedin_meta = _format_linkedin_section(
        linkedin_context, _section_char_budget(total_budget, "linkedin")
    )

    parts = [
        "=== CUSTOMER RECORD (CRM) ===\n",
        customer_section,
        "\n",
        rag_section,
        "\n",
        crm_section,
        "\n",
        web_section,
        "\n",
        linkedin_section,
    ]
    context = "".join(parts)

    if len(context) > PROFILE_CONTEXT_MAX_CHARS:
        marker = (
            f"\n\n...[total research context capped at {PROFILE_CONTEXT_MAX_CHARS:,} chars]...\n\n"
        )
        usable = PROFILE_CONTEXT_MAX_CHARS - len(marker)
        head = usable // 3
        tail = usable - head
        context = context[:head] + marker + context[-tail:]
        context_capped = True
    else:
        context_capped = False

    meta: Dict[str, Any] = {
        **rag_meta,
        **crm_meta,
        **web_meta,
        **linkedin_meta,
        "total_research_chars_raw": (
            len(customer_section)
            + rag_meta.get("rag_chars", 0)
            + crm_meta.get("crm_chars", 0)
            + web_meta.get("web_search_chars", 0)
            + linkedin_meta.get("linkedin_chars", 0)
        ),
        "total_research_chars_sent": len(context),
        "context_max_chars": PROFILE_CONTEXT_MAX_CHARS,
        "context_capped": context_capped,
    }
    return context, meta
