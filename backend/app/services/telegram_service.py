"""
Telegram integration — same bot + message format as legacy CRM notifications.

Set TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID (group/channel id) in Vercel or backend/.env.
Optional: NOTIFICATION_ENABLED=false to disable sends while keeping credentials loaded.
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

import httpx

from app.config import settings

logger = logging.getLogger(__name__)

TELEGRAM_API = "https://api.telegram.org/bot{token}/{method}"


def telegram_configured() -> bool:
    """True when bot token and at least one chat id are set."""
    if not settings.TELEGRAM_BOT_TOKEN.strip():
        return False
    if not settings.TELEGRAM_CHAT_ID.strip():
        return False
    return settings.NOTIFICATION_ENABLED


def _chat_ids() -> List[str]:
    return [
        c.strip()
        for c in (settings.TELEGRAM_CHAT_ID or "").split(",")
        if c.strip()
    ]


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


def _strip_internal_prefix(text: str) -> str:
    t = (text or "").strip()
    if t.lower().startswith("[telegram_backfill]"):
        t = t.split("\n", 1)[-1].strip()
    return t


def should_notify_telegram_for_interaction(input_text: str) -> bool:
    """Skip system/backfill rows that should not re-post to Telegram."""
    t = _strip_internal_prefix(input_text).lower()
    if not t:
        return True
    if t.startswith("system:"):
        return False
    if "ai profile generated" in t:
        return False
    return True


def format_crm_bot_notification(
    *,
    customer_name: str,
    customer_id: str,
    input_text: str,
    ai_response: str,
    created_at: Optional[str] = None,
    file_url: Optional[str] = None,
) -> str:
    """
    Match the legacy CRM Telegram bot layout (same as imported result.json messages).
    """
    ts = created_at or datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")
    user_input = _strip_internal_prefix(input_text) or "—"
    ai_text = (ai_response or "").strip() or "—"

    lines = [
        "💬 New Customer Interaction!",
        "",
        f"👤 Customer: {customer_name}",
        f"🆔 Customer ID: {customer_id}",
        f"📅 Timestamp: {ts}",
        "",
        f"User Input: {user_input}",
        "",
        f"AI Response: {ai_text}",
    ]
    if file_url and str(file_url).strip():
        lines.extend(["", f"📎 File Attached: {file_url.strip()}"])
    return "\n".join(lines)[:4000]


def send_telegram_message(text: str, *, chat_id: Optional[str] = None) -> bool:
    if not settings.TELEGRAM_BOT_TOKEN.strip():
        return False
    targets = [chat_id] if chat_id else _chat_ids()
    ok = False
    for cid in targets:
        if not cid:
            continue
        data = _post_telegram(
            "sendMessage",
            {
                "chat_id": cid,
                "text": text[:4000],
                "disable_web_page_preview": True,
            },
        )
        if data and data.get("ok"):
            ok = True
    return ok


def notify_interaction_saved(
    *,
    customer_name: str,
    customer_id: str,
    input_text: str,
    ai_response: str,
    created_at: Optional[str] = None,
    file_url: Optional[str] = None,
    source: str = "crm",
) -> None:
    """Post to the CRM Telegram group when a new interaction is saved in the dashboard."""
    if not telegram_configured():
        return
    if not should_notify_telegram_for_interaction(input_text):
        return

    text = format_crm_bot_notification(
        customer_name=customer_name,
        customer_id=str(customer_id),
        input_text=input_text,
        ai_response=ai_response,
        created_at=created_at,
        file_url=file_url,
    )
    if not send_telegram_message(text):
        logger.warning(
            "Telegram notify failed for customer %s (%s)", customer_name, customer_id
        )


def telegram_status() -> Dict[str, Any]:
    return {
        "configured_in_this_app": telegram_configured(),
        "bot_token_set": bool(settings.TELEGRAM_BOT_TOKEN.strip()),
        "chat_ids": _chat_ids(),
        "notification_enabled": settings.NOTIFICATION_ENABLED,
        "message_format": "CRM bot (💬 New Customer Interaction! + User Input / AI Response)",
        "setup": (
            "Set TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID, and NOTIFICATION_ENABLED=true "
            "on Vercel (Settings → Environment Variables) or backend/.env, then redeploy."
        ),
        "inbound_backfill": (
            "Use scripts/backfill_telegram_to_interactions.py with Telegram Desktop result.json "
            "for historical imports."
        ),
    }


def fetch_bot_updates(*, limit: int = 100, offset: Optional[int] = None) -> List[Dict[str, Any]]:
    if not settings.TELEGRAM_BOT_TOKEN.strip():
        return []
    payload: Dict[str, Any] = {"limit": min(limit, 100), "timeout": 0}
    if offset is not None:
        payload["offset"] = offset
    data = _post_telegram("getUpdates", payload) or {}
    return list(data.get("result") or [])
