"""
Legacy conversation archives in public.conversation (e.g. ChatGPT exports).

Rows with metadata.source = conversations_json were bulk-imported from conversations.json
without metadata.customer_id, so they never appeared in per-customer CRM history until linked
by customer name search.
"""

from __future__ import annotations

import re
from typing import Any, Dict, List, Optional, Set

from app.database.connection import get_supabase_service_client

_CHATGPT_ARCHIVED_FLAG_RE = re.compile(
    r"""(?:'is_archived'|"is_archived")\s*:\s*(?:True|true)""",
    re.IGNORECASE,
)
_CHATGPT_STUB_AI_MARKER = "Archived ChatGPT conversation (imported from conversations.json)"


def chatgpt_export_content_is_archived(content: str) -> bool:
    """True when the raw conversations.json row is marked archived in ChatGPT."""
    return bool(_CHATGPT_ARCHIVED_FLAG_RE.search(content or ""))


def is_chatgpt_export_ui_stub(user_text: str, ai_text: str) -> bool:
    """Placeholder rows with no real transcript (legacy parser fallback)."""
    ai = (ai_text or "").strip()
    if _CHATGPT_STUB_AI_MARKER in ai:
        return True
    user = (user_text or "").strip()
    return user.startswith("[ChatGPT export]") and not ai


def _name_search_variants(customer_name: str) -> List[str]:
    name = (customer_name or "").strip()
    if not name:
        return []
    variants: Set[str] = {name}
    # Mc-Bauchemie Chemical Manufacturing PLC → Mc-Bauchemie, Bauchemie, Mc-Bauchemi
    first_token = name.split()[0] if name.split() else ""
    if first_token:
        variants.add(first_token)
    if " " in name:
        variants.add(name.split()[0])
    for part in re.split(r"[\s\-]+", name):
        if len(part) >= 5:
            variants.add(part)
    # Common typo in ChatGPT title
    variants.add(name.replace("Mc-Bauchemie", "Mc-Bauchemi"))
    variants.add(name.replace("Bauchemie", "Bauchemi"))
    return [v for v in variants if len(v) >= 4]


def _parse_chatgpt_export_row(content: str) -> tuple[str, str, Optional[str]]:
    """Best-effort parse of imported ChatGPT export text."""
    title = "ChatGPT archive"
    m = re.search(r"title:\s*(.+?)(?:\n|$)", content or "")
    if m:
        title = m.group(1).strip()

    create_time = None
    ct = re.search(r"create_time:\s*([\d.]+)", content or "")
    if ct:
        try:
            from datetime import datetime, timezone

            ts = float(ct.group(1))
            create_time = datetime.fromtimestamp(ts, tz=timezone.utc).isoformat()
        except (ValueError, OSError):
            create_time = None

    def _clean(s: str) -> str:
        return s.replace("\\n", "\n").replace("\\'", "'").replace('\\"', '"').strip()

    def _extract_role_parts(role: str) -> List[str]:
        pattern = (
            rf"['\"]role['\"]\s*:\s*['\"]{role}['\"]"
            rf".*?['\"]parts['\"]\s*:\s*\[\s*['\"]((?:\\'|[^'\"])*)['\"]"
        )
        return [_clean(m) for m in re.findall(pattern, content or "", flags=re.DOTALL | re.IGNORECASE)]

    user_parts = [p for p in _extract_role_parts("user") if p]
    assistant_parts = [p for p in _extract_role_parts("assistant") if p]

    user_text = user_parts[0] if user_parts else ""
    ai_text = assistant_parts[0] if assistant_parts else ""

    if not user_text:
        user_text = f"[ChatGPT export] {title}"
    if not ai_text:
        ai_text = (
            "Imported ChatGPT conversation (open full export in Supabase for complete transcript)."
        )

    return user_text[:12000], ai_text[:12000], create_time


def get_chatgpt_export_archives_for_customer(
    customer_id: str,
    customer_name: str,
    *,
    max_rows: int = 30,
) -> List[Dict[str, Any]]:
    """
    Find conversations_json rows that mention this customer but lack metadata.customer_id.
    """
    supabase = get_supabase_service_client()
    cid = str(customer_id)
    seen_ids: Set[str] = set()
    collected: List[Dict[str, Any]] = []

    for variant in _name_search_variants(customer_name):
        if len(collected) >= max_rows:
            break
        try:
            resp = (
                supabase.table("conversation")
                .select("id, content, metadata, created_at")
                .eq("metadata->>source", "conversations_json")
                .ilike("content", f"%{variant}%")
                .order("created_at", desc=True)
                .limit(max_rows)
                .execute()
            )
        except Exception:
            continue

        for row in resp.data or []:
            row_id = str(row.get("id") or "")
            if not row_id or row_id in seen_ids:
                continue
            meta = row.get("metadata") or {}
            if isinstance(meta, dict) and str(meta.get("customer_id") or "") == cid:
                continue
            seen_ids.add(row_id)
            collected.append(row)
            if len(collected) >= max_rows:
                break

    return collected
