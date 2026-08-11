"""
Telegram integration — celebration + optional CRM interaction posts.

Channel policy (default):
  - Always announce when a sales deal reaches Closed (won)
  - Announce big sales at Confirmation (value ≥ TELEGRAM_BIG_SALE_THRESHOLD_USD)
  - Do not spam every CRM interaction (TELEGRAM_NOTIFY_INTERACTIONS=false)

Set TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID in Vercel or backend/.env.
"""

from __future__ import annotations

import logging
import re
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

import httpx

from app.config import settings

logger = logging.getLogger(__name__)

TELEGRAM_API = "https://api.telegram.org/bot{token}/{method}"

# Fallback FX when pipeline.forex is missing (rough USD conversion for thresholds).
_FALLBACK_USD_RATES = {
    "USD": 1.0,
    "EUR": 1.08,
    "GBP": 1.27,
    "KES": 0.0077,
    "ETB": 0.0075,
}


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
    """Skip system/backfill rows; also gated by TELEGRAM_NOTIFY_INTERACTIONS."""
    if not getattr(settings, "TELEGRAM_NOTIFY_INTERACTIONS", False):
        return False
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
    """Match the legacy CRM Telegram bot layout."""
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
    """Post to Telegram only when TELEGRAM_NOTIFY_INTERACTIONS is enabled."""
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


def _parse_forex_to_usd(forex: Optional[str], currency: Optional[str]) -> float:
    """Return multiplier that converts 1 unit of currency → USD."""
    cur = (currency or "USD").strip().upper() or "USD"
    if cur == "USD":
        return 1.0
    raw = (forex or "").strip()
    if raw:
        nums = re.findall(r"[\d]+(?:\.\d+)?", raw.replace(",", ""))
        if nums:
            rate = float(nums[0])
            if rate > 0:
                # Local-per-USD rates (ETB/KES) are typically >> 1 → invert.
                if rate >= 2:
                    return 1.0 / rate
                return rate
    return _FALLBACK_USD_RATES.get(cur, 1.0)


def deal_value_usd(
    *,
    amount: Optional[float],
    unit_price: Optional[float],
    currency: Optional[str] = None,
    forex: Optional[str] = None,
) -> float:
    qty = float(amount or 0)
    price = float(unit_price or 0)
    local = qty * price if qty and price else qty
    if local <= 0:
        return 0.0
    return local * _parse_forex_to_usd(forex, currency)


def is_big_sale_usd(value_usd: float) -> bool:
    threshold = float(
        getattr(settings, "TELEGRAM_BIG_SALE_THRESHOLD_USD", 10000) or 10000
    )
    return value_usd >= threshold


def _format_money(amount: float, currency: Optional[str]) -> str:
    cur = (currency or "").strip().upper() or "USD"
    try:
        return f"{amount:,.0f} {cur}"
    except (TypeError, ValueError):
        return f"{amount} {cur}"


def format_deal_closed_notification(
    *,
    customer_name: str,
    product_name: Optional[str],
    amount: Optional[float],
    unit: Optional[str],
    unit_price: Optional[float],
    currency: Optional[str],
    value_usd: float,
    close_reason: Optional[str] = None,
    owner_hint: Optional[str] = None,
) -> str:
    qty = float(amount or 0)
    price = float(unit_price or 0)
    local = qty * price if qty and price else qty
    lines = [
        "🏆 DEAL CLOSED — WIN!",
        "",
        "Big congratulations to the team — another deal across the finish line.",
        "",
        f"👤 Customer: {customer_name or '—'}",
        f"🧪 Product: {(product_name or '—').strip() or '—'}",
    ]
    if qty:
        u = (unit or "kg").strip() or "kg"
        lines.append(f"📦 Volume: {qty:,.0f} {u}")
    if local > 0:
        lines.append(f"💰 Deal value: {_format_money(local, currency)}")
    if value_usd > 0 and (currency or "").upper() != "USD":
        lines.append(f"≈ ${value_usd:,.0f} USD")
    if close_reason and str(close_reason).strip():
        lines.extend(["", f"✅ Close note: {str(close_reason).strip()}"])
    if owner_hint and str(owner_hint).strip():
        lines.extend(["", f"👏 Shout-out: {str(owner_hint).strip()}"])
    lines.extend(["", "Keep closing. Keep winning. 💪"])
    return "\n".join(lines)[:4000]


def format_big_sale_notification(
    *,
    customer_name: str,
    product_name: Optional[str],
    amount: Optional[float],
    unit: Optional[str],
    unit_price: Optional[float],
    currency: Optional[str],
    value_usd: float,
    stage: str = "Confirmation",
) -> str:
    qty = float(amount or 0)
    price = float(unit_price or 0)
    local = qty * price if qty and price else qty
    lines = [
        "🚀 BIG SALE ALERT!",
        "",
        "A large order just landed — this is the kind of win we celebrate together.",
        "",
        f"📌 Stage: {stage}",
        f"👤 Customer: {customer_name or '—'}",
        f"🧪 Product: {(product_name or '—').strip() or '—'}",
    ]
    if qty:
        u = (unit or "kg").strip() or "kg"
        lines.append(f"📦 Volume: {qty:,.0f} {u}")
    if local > 0:
        lines.append(f"💰 Deal value: {_format_money(local, currency)}")
    if value_usd > 0:
        lines.append(f"≈ ${value_usd:,.0f} USD")
    lines.extend(
        [
            "",
            "Great work — let’s convert this into a clean Closed win. 🔥",
        ]
    )
    return "\n".join(lines)[:4000]


def notify_deal_closed(
    *,
    customer_name: str,
    product_name: Optional[str] = None,
    amount: Optional[float] = None,
    unit: Optional[str] = None,
    unit_price: Optional[float] = None,
    currency: Optional[str] = None,
    forex: Optional[str] = None,
    close_reason: Optional[str] = None,
    owner_hint: Optional[str] = None,
) -> None:
    """Delegate to celebration_notify (WhatsApp by default)."""
    from app.services.celebration_notify import notify_deal_closed as _notify

    _notify(
        customer_name=customer_name,
        product_name=product_name,
        amount=amount,
        unit=unit,
        unit_price=unit_price,
        currency=currency,
        forex=forex,
        close_reason=close_reason,
        owner_hint=owner_hint,
    )


def notify_big_sale(
    *,
    customer_name: str,
    product_name: Optional[str] = None,
    amount: Optional[float] = None,
    unit: Optional[str] = None,
    unit_price: Optional[float] = None,
    currency: Optional[str] = None,
    forex: Optional[str] = None,
    stage: str = "Confirmation",
) -> None:
    """Delegate to celebration_notify (WhatsApp by default)."""
    from app.services.celebration_notify import notify_big_sale as _notify

    _notify(
        customer_name=customer_name,
        product_name=product_name,
        amount=amount,
        unit=unit,
        unit_price=unit_price,
        currency=currency,
        forex=forex,
        stage=stage,
    )


def notify_pipeline_stage_celebration(
    *,
    previous_stage: Optional[str],
    pipeline: Any,
    customer_name: Optional[str] = None,
    product_name: Optional[str] = None,
) -> None:
    """Delegate to celebration_notify (WhatsApp by default)."""
    from app.services.celebration_notify import (
        notify_pipeline_stage_celebration as _notify,
    )

    _notify(
        previous_stage=previous_stage,
        pipeline=pipeline,
        customer_name=customer_name,
        product_name=product_name,
    )


def telegram_status() -> Dict[str, Any]:
    return {
        "configured_in_this_app": telegram_configured(),
        "bot_token_set": bool(settings.TELEGRAM_BOT_TOKEN.strip()),
        "chat_ids": _chat_ids(),
        "notification_enabled": settings.NOTIFICATION_ENABLED,
        "notification_channel": getattr(settings, "NOTIFICATION_CHANNEL", "whatsapp"),
        "notify_interactions": bool(
            getattr(settings, "TELEGRAM_NOTIFY_INTERACTIONS", False)
        ),
        "big_sale_threshold_usd": float(
            getattr(settings, "TELEGRAM_BIG_SALE_THRESHOLD_USD", 10000) or 10000
        ),
        "message_format": (
            "Celebrations route via NOTIFICATION_CHANNEL (default whatsapp). "
            "Closed always; big sales at Confirmation ≥ threshold."
        ),
        "setup": (
            "Prefer WhatsApp: set WHATSAPP_* + NOTIFICATION_CHANNEL=whatsapp. "
            "Optional Telegram: TELEGRAM_BOT_TOKEN + TELEGRAM_CHAT_ID and "
            "NOTIFICATION_CHANNEL=telegram or both."
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
