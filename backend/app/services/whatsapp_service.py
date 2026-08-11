"""
WhatsApp outbound notifications (Meta Cloud API + optional Twilio).

Official WhatsApp Business API cannot post into arbitrary chat groups like a
Telegram bot. Instead we broadcast celebration messages to each team number in
WHATSAPP_TO (E.164, comma-separated).

Free-form text works inside an open customer-care window. For cold outbound,
approve Meta templates and set WHATSAPP_TEMPLATE_DEAL_CLOSED /
WHATSAPP_TEMPLATE_BIG_SALE.
"""

from __future__ import annotations

import logging
import re
from typing import Any, Dict, List, Optional

import httpx

from app.config import settings

logger = logging.getLogger(__name__)


def _digits_only(value: str) -> str:
    return re.sub(r"\D+", "", value or "")


def normalize_whatsapp_number(value: str) -> Optional[str]:
    """Return E.164 digits without '+', or None if unusable."""
    raw = (value or "").strip()
    if not raw:
        return None
    if raw.startswith("whatsapp:"):
        raw = raw.split(":", 1)[1].strip()
    digits = _digits_only(raw)
    if len(digits) < 8:
        return None
    return digits


def whatsapp_recipients() -> List[str]:
    return [
        n
        for n in (
            normalize_whatsapp_number(part)
            for part in (settings.WHATSAPP_TO or "").split(",")
        )
        if n
    ]


def whatsapp_configured() -> bool:
    if not settings.NOTIFICATION_ENABLED:
        return False
    if not whatsapp_recipients():
        return False
    provider = (settings.WHATSAPP_PROVIDER or "meta").strip().lower()
    if provider == "twilio":
        return bool(
            settings.TWILIO_ACCOUNT_SID.strip()
            and settings.TWILIO_AUTH_TOKEN.strip()
            and settings.TWILIO_WHATSAPP_FROM.strip()
        )
    return bool(
        settings.WHATSAPP_ACCESS_TOKEN.strip()
        and settings.WHATSAPP_PHONE_NUMBER_ID.strip()
    )


def _send_meta_text(to: str, body: str) -> bool:
    token = settings.WHATSAPP_ACCESS_TOKEN.strip()
    phone_id = settings.WHATSAPP_PHONE_NUMBER_ID.strip()
    version = (settings.WHATSAPP_API_VERSION or "v21.0").strip() or "v21.0"
    url = f"https://graph.facebook.com/{version}/{phone_id}/messages"
    payload = {
        "messaging_product": "whatsapp",
        "recipient_type": "individual",
        "to": to,
        "type": "text",
        "text": {"preview_url": False, "body": body[:4096]},
    }
    try:
        with httpx.Client(timeout=25.0) as client:
            resp = client.post(
                url,
                headers={
                    "Authorization": f"Bearer {token}",
                    "Content-Type": "application/json",
                },
                json=payload,
            )
            data = resp.json() if resp.content else {}
            if resp.status_code >= 400 or data.get("error"):
                logger.warning(
                    "WhatsApp Meta text failed for %s: %s %s",
                    to,
                    resp.status_code,
                    data,
                )
                return False
            return True
    except Exception as exc:
        logger.warning("WhatsApp Meta text error for %s: %s", to, exc)
        return False


def _send_meta_template(
    to: str,
    *,
    template_name: str,
    language_code: str,
    body_params: List[str],
) -> bool:
    token = settings.WHATSAPP_ACCESS_TOKEN.strip()
    phone_id = settings.WHATSAPP_PHONE_NUMBER_ID.strip()
    version = (settings.WHATSAPP_API_VERSION or "v21.0").strip() or "v21.0"
    url = f"https://graph.facebook.com/{version}/{phone_id}/messages"
    components: List[Dict[str, Any]] = []
    if body_params:
        components.append(
            {
                "type": "body",
                "parameters": [
                    {"type": "text", "text": str(p)[:1024]} for p in body_params
                ],
            }
        )
    payload = {
        "messaging_product": "whatsapp",
        "to": to,
        "type": "template",
        "template": {
            "name": template_name,
            "language": {"code": language_code or "en"},
            "components": components,
        },
    }
    try:
        with httpx.Client(timeout=25.0) as client:
            resp = client.post(
                url,
                headers={
                    "Authorization": f"Bearer {token}",
                    "Content-Type": "application/json",
                },
                json=payload,
            )
            data = resp.json() if resp.content else {}
            if resp.status_code >= 400 or data.get("error"):
                logger.warning(
                    "WhatsApp Meta template failed for %s: %s %s",
                    to,
                    resp.status_code,
                    data,
                )
                return False
            return True
    except Exception as exc:
        logger.warning("WhatsApp Meta template error for %s: %s", to, exc)
        return False


def _send_twilio_text(to: str, body: str) -> bool:
    sid = settings.TWILIO_ACCOUNT_SID.strip()
    token = settings.TWILIO_AUTH_TOKEN.strip()
    from_number = settings.TWILIO_WHATSAPP_FROM.strip()
    if not from_number.startswith("whatsapp:"):
        from_number = f"whatsapp:+{_digits_only(from_number)}"
    to_addr = f"whatsapp:+{to}"
    url = f"https://api.twilio.com/2010-04-01/Accounts/{sid}/Messages.json"
    try:
        with httpx.Client(timeout=25.0) as client:
            resp = client.post(
                url,
                data={"From": from_number, "To": to_addr, "Body": body[:1600]},
                auth=(sid, token),
            )
            if resp.status_code >= 400:
                logger.warning(
                    "WhatsApp Twilio failed for %s: %s %s",
                    to,
                    resp.status_code,
                    resp.text[:500],
                )
                return False
            return True
    except Exception as exc:
        logger.warning("WhatsApp Twilio error for %s: %s", to, exc)
        return False


def send_whatsapp_message(
    text: str,
    *,
    to: Optional[str] = None,
    template_name: Optional[str] = None,
    template_params: Optional[List[str]] = None,
    language_code: Optional[str] = None,
) -> bool:
    """Send text (or optional approved template) to one or all configured numbers."""
    if not settings.NOTIFICATION_ENABLED:
        return False
    targets = [normalize_whatsapp_number(to)] if to else whatsapp_recipients()
    targets = [t for t in targets if t]
    if not targets:
        return False

    provider = (settings.WHATSAPP_PROVIDER or "meta").strip().lower()
    ok = False
    use_template = bool(template_name and settings.WHATSAPP_USE_TEMPLATES)
    for number in targets:
        sent = False
        if provider == "twilio":
            sent = _send_twilio_text(number, text)
        elif use_template and template_name:
            sent = _send_meta_template(
                number,
                template_name=template_name,
                language_code=language_code or settings.WHATSAPP_TEMPLATE_LANGUAGE or "en",
                body_params=template_params or [],
            )
            if not sent:
                # Fall back to free-form text if template fails (open window).
                sent = _send_meta_text(number, text)
        else:
            sent = _send_meta_text(number, text)
        if sent:
            ok = True
    return ok


def whatsapp_status() -> Dict[str, Any]:
    provider = (settings.WHATSAPP_PROVIDER or "meta").strip().lower()
    return {
        "configured_in_this_app": whatsapp_configured(),
        "provider": provider,
        "recipients": whatsapp_recipients(),
        "phone_number_id_set": bool(settings.WHATSAPP_PHONE_NUMBER_ID.strip()),
        "access_token_set": bool(settings.WHATSAPP_ACCESS_TOKEN.strip()),
        "twilio_sid_set": bool(settings.TWILIO_ACCOUNT_SID.strip()),
        "use_templates": bool(settings.WHATSAPP_USE_TEMPLATES),
        "template_deal_closed": settings.WHATSAPP_TEMPLATE_DEAL_CLOSED or None,
        "template_big_sale": settings.WHATSAPP_TEMPLATE_BIG_SALE or None,
        "notification_enabled": settings.NOTIFICATION_ENABLED,
        "note": (
            "WhatsApp Business API sends to individual numbers (WHATSAPP_TO), "
            "not into a classic WhatsApp group chat. Add each team member's phone."
        ),
        "setup": (
            "Meta: set WHATSAPP_ACCESS_TOKEN, WHATSAPP_PHONE_NUMBER_ID, WHATSAPP_TO "
            "(E.164, comma-separated), NOTIFICATION_CHANNEL=whatsapp. "
            "Optional Twilio: WHATSAPP_PROVIDER=twilio + TWILIO_* vars."
        ),
    }
