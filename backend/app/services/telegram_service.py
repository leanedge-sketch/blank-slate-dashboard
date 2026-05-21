"""
Telegram integration (notifications + optional ingest).

This dashboard does NOT historically send CRM events to Telegram from this repo;
many teams wire Supabase INSERT webhooks or a separate Streamlit/n8n worker instead.

When TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID are set, new interactions can be pushed
to Telegram. Inbound backfill uses Bot API getUpdates (only messages the bot received).
"""

from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional

import httpx

from app.config import settings

logger = logging.getLogger(__name__)

TELEGRAM_API = "https://api.telegram.org/bot{token}/{method}"


def telegram_configured() -> bool:
    return bool(settings.TELEGRAM_BOT_TOKEN.strip() and settings.TELEGRAM_CHAT_ID.strip())


def telegram_status() -> Dict[str, Any]:
    """Diagnostic payload for CRM integrations UI / scripts."""
    chat_ids = [
        c.strip()
        for c in (settings.TELEGRAM_CHAT_ID or "").split(",")
        if c.strip()
    ]
    return {
        "configured_in_this_app": telegram_configured(),
        "bot_token_set": bool(settings.TELEGRAM_BOT_TOKEN.strip()),
        "chat_ids": chat_ids,
        "inbound_backfill": (
            "Bot API getUpdates only returns messages this bot received. "
            "It cannot read full group history unless the bot was present when messages were sent. "
            "For older chats, export from Telegram Desktop (Settings → Advanced → Export) "
            "or trace your external notifier (Supabase Database Webhooks / n8n / Streamlit)."
        ),
        "likely_external_paths": [
            "Supabase Dashboard → Database → Webhooks on public.interactions INSERT",
            "Legacy Streamlit CRM (docs still reference Streamlit clients)",
            "Automation (n8n/Make) posting to a Telegram channel",
        ],
    }


def _post_telegram(method: str, payload: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    token = settings.TELEGRAM_BOT_TOKEN.strip()
    if not token:
        return None
    url = TELEGRAM_API.format(token=token, method=method)
    try:
        with httpx.Client(timeout=20.0) as client:
            resp = client.post(url, json=payload)
            resp.raise_for_status()
            data = resp.json()
            if not data.get("ok"):
                logger.warning("Telegram %s failed: %s", method, data)
            return data
    except Exception as exc:
        logger.warning("Telegram %s error: %s", method, exc)
        return None


def notify_interaction_saved(
    *,
    customer_name: str,
    customer_id: str,
    input_text: str,
    ai_response: str,
    created_at: Optional[str] = None,
    source: str = "crm",
) -> None:
    """Fire-and-forget notification when an interaction is stored."""
    if not telegram_configured():
        return

    preview_in = (input_text or "").strip().replace("\n", " ")[:400]
    preview_ai = (ai_response or "").strip().replace("\n", " ")[:400]
    when = created_at or "now"
    text = (
        f"LeanChem CRM — new interaction ({source})\n"
        f"Customer: {customer_name} ({customer_id})\n"
        f"Time: {when}\n\n"
        f"Note:\n{preview_in or '—'}\n\n"
        f"AI:\n{preview_ai or '—'}"
    )

    chat_ids = [
        c.strip()
        for c in settings.TELEGRAM_CHAT_ID.split(",")
        if c.strip()
    ]
    for chat_id in chat_ids:
        _post_telegram(
            "sendMessage",
            {
                "chat_id": chat_id,
                "text": text[:4000],
                "disable_web_page_preview": True,
            },
        )


def fetch_bot_updates(*, limit: int = 100, offset: Optional[int] = None) -> List[Dict[str, Any]]:
    """
    Read recent updates received by this bot (not full channel history).
    """
    if not settings.TELEGRAM_BOT_TOKEN.strip():
        return []
    payload: Dict[str, Any] = {"limit": min(limit, 100)}
    if offset is not None:
        payload["offset"] = offset
    data = _post_telegram("getUpdates", payload) or {}
    return list(data.get("result") or [])
