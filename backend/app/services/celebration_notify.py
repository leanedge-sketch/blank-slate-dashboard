"""
Sales celebration notifications — WhatsApp by default, Telegram optional.

Rules:
  - Closed (won): always notify
  - Confirmation + value ≥ TELEGRAM_BIG_SALE_THRESHOLD_USD: big-sale notify
  - Routine CRM interactions: off unless TELEGRAM_NOTIFY_INTERACTIONS=true
"""

from __future__ import annotations

import logging
from typing import Any, Optional

from app.config import settings

logger = logging.getLogger(__name__)


def _channels() -> set[str]:
    raw = (getattr(settings, "NOTIFICATION_CHANNEL", "whatsapp") or "whatsapp").strip().lower()
    if raw in ("both", "all"):
        return {"whatsapp", "telegram"}
    if raw in ("telegram", "tg"):
        return {"telegram"}
    if raw in ("none", "off", "disabled"):
        return set()
    return {"whatsapp"}


def _send_celebration(
    text: str,
    *,
    template_name: Optional[str] = None,
    template_params: Optional[list[str]] = None,
) -> None:
    channels = _channels()
    if not channels:
        return

    if "whatsapp" in channels:
        try:
            from app.services.whatsapp_service import (
                send_whatsapp_message,
                whatsapp_configured,
            )

            if whatsapp_configured():
                ok = send_whatsapp_message(
                    text,
                    template_name=template_name,
                    template_params=template_params,
                )
                if not ok:
                    logger.warning("WhatsApp celebration send failed")
            else:
                logger.info("WhatsApp celebration skipped — not configured")
        except Exception as exc:
            logger.warning("WhatsApp celebration error: %s", exc)

    if "telegram" in channels:
        try:
            from app.services.telegram_service import (
                send_telegram_message,
                telegram_configured,
            )

            if telegram_configured():
                if not send_telegram_message(text):
                    logger.warning("Telegram celebration send failed")
        except Exception as exc:
            logger.warning("Telegram celebration error: %s", exc)


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
    from app.services.telegram_service import (
        deal_value_usd,
        format_deal_closed_notification,
    )

    value_usd = deal_value_usd(
        amount=amount, unit_price=unit_price, currency=currency, forex=forex
    )
    text = format_deal_closed_notification(
        customer_name=customer_name,
        product_name=product_name,
        amount=amount,
        unit=unit,
        unit_price=unit_price,
        currency=currency,
        value_usd=value_usd,
        close_reason=close_reason,
        owner_hint=owner_hint,
    )
    qty = float(amount or 0)
    price = float(unit_price or 0)
    local = qty * price if qty and price else qty
    params = [
        customer_name or "—",
        (product_name or "—").strip() or "—",
        f"{local:,.0f} {(currency or 'USD')}" if local else "—",
        (close_reason or "Deal won").strip()[:200],
    ]
    _send_celebration(
        text,
        template_name=getattr(settings, "WHATSAPP_TEMPLATE_DEAL_CLOSED", None) or None,
        template_params=params,
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
    from app.services.telegram_service import (
        deal_value_usd,
        format_big_sale_notification,
        is_big_sale_usd,
    )

    value_usd = deal_value_usd(
        amount=amount, unit_price=unit_price, currency=currency, forex=forex
    )
    if not is_big_sale_usd(value_usd):
        return
    text = format_big_sale_notification(
        customer_name=customer_name,
        product_name=product_name,
        amount=amount,
        unit=unit,
        unit_price=unit_price,
        currency=currency,
        value_usd=value_usd,
        stage=stage,
    )
    qty = float(amount or 0)
    price = float(unit_price or 0)
    local = qty * price if qty and price else qty
    params = [
        customer_name or "—",
        (product_name or "—").strip() or "—",
        f"{local:,.0f} {(currency or 'USD')}" if local else f"${value_usd:,.0f} USD",
        stage,
    ]
    _send_celebration(
        text,
        template_name=getattr(settings, "WHATSAPP_TEMPLATE_BIG_SALE", None) or None,
        template_params=params,
    )


def notify_pipeline_stage_celebration(
    *,
    previous_stage: Optional[str],
    pipeline: Any,
    customer_name: Optional[str] = None,
    product_name: Optional[str] = None,
) -> None:
    if pipeline is None:
        return

    new_stage = getattr(pipeline, "stage", None)
    if not new_stage or new_stage == previous_stage:
        return

    name = (customer_name or "").strip() or "Customer"
    product = (product_name or "").strip() or None
    amount = getattr(pipeline, "amount", None)
    unit = getattr(pipeline, "unit", None)
    unit_price = getattr(pipeline, "unit_price", None)
    currency = getattr(pipeline, "currency", None)
    forex = getattr(pipeline, "forex", None)
    close_reason = getattr(pipeline, "close_reason", None)
    contact = getattr(pipeline, "contact_per_lead", None)

    try:
        if new_stage == "Closed" and previous_stage != "Closed":
            notify_deal_closed(
                customer_name=name,
                product_name=product,
                amount=amount,
                unit=unit,
                unit_price=unit_price,
                currency=currency,
                forex=forex,
                close_reason=close_reason,
                owner_hint=str(contact).strip() if contact else None,
            )
            return

        if new_stage == "Confirmation" and previous_stage != "Confirmation":
            notify_big_sale(
                customer_name=name,
                product_name=product,
                amount=amount,
                unit=unit,
                unit_price=unit_price,
                currency=currency,
                forex=forex,
                stage="Confirmation",
            )
    except Exception as exc:
        logger.warning("Celebration notify skipped: %s", exc)
