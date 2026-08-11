"""
External integration diagnostics (WhatsApp, Telegram, legacy archives).
"""

from typing import Any, Dict, List, Optional

from fastapi import APIRouter, HTTPException, Query

from app.config import settings
from app.services.crm_service import get_customer_by_id
from app.services.conversation_archive_service import (
    get_chatgpt_export_archives_for_customer,
)
from app.services.telegram_backfill_service import (
    backfill_from_bot_updates,
    backfill_from_export_file,
    backfill_requirements,
)
from app.services.telegram_service import (
    fetch_bot_updates,
    send_telegram_message,
    telegram_configured,
    telegram_status,
)
from app.services.whatsapp_service import (
    send_whatsapp_message,
    whatsapp_configured,
    whatsapp_status,
)

router = APIRouter(prefix="/integrations", tags=["integrations"])


@router.get("/notifications/status")
async def get_notification_channels_status() -> Dict[str, Any]:
    """Active celebration channel(s) and WhatsApp / Telegram setup."""
    return {
        "channel": getattr(settings, "NOTIFICATION_CHANNEL", "whatsapp"),
        "notification_enabled": settings.NOTIFICATION_ENABLED,
        "big_sale_threshold_usd": float(
            getattr(settings, "TELEGRAM_BIG_SALE_THRESHOLD_USD", 10000) or 10000
        ),
        "whatsapp": whatsapp_status(),
        "telegram": telegram_status(),
    }


@router.get("/whatsapp/status")
async def get_whatsapp_integration_status() -> Dict[str, Any]:
    return whatsapp_status()


@router.post("/whatsapp/test")
async def send_test_whatsapp_notification(
    kind: str = Query("closed", description="closed | big_sale"),
) -> Dict[str, Any]:
    """Send a test celebration to WHATSAPP_TO numbers."""
    if not whatsapp_configured():
        raise HTTPException(
            status_code=400,
            detail=(
                "WhatsApp not active. Set WHATSAPP_ACCESS_TOKEN, WHATSAPP_PHONE_NUMBER_ID, "
                "WHATSAPP_TO (team phones), and NOTIFICATION_ENABLED=true."
            ),
        )
    from app.services.telegram_service import (
        format_big_sale_notification,
        format_deal_closed_notification,
    )

    kind_norm = (kind or "closed").strip().lower()
    if kind_norm in ("big", "big_sale", "sale"):
        text = format_big_sale_notification(
            customer_name="Test Customer",
            product_name="Test Chemical",
            amount=25000,
            unit="kg",
            unit_price=1.2,
            currency="USD",
            value_usd=30000,
            stage="Confirmation",
        )
        label = "big_sale"
        template = settings.WHATSAPP_TEMPLATE_BIG_SALE or None
        params = ["Test Customer", "Test Chemical", "30,000 USD", "Confirmation"]
    else:
        text = format_deal_closed_notification(
            customer_name="Test Customer",
            product_name="Test Chemical",
            amount=12000,
            unit="kg",
            unit_price=1.5,
            currency="USD",
            value_usd=18000,
            close_reason="PO received — test celebration",
            owner_hint="Sales team",
        )
        label = "closed"
        template = settings.WHATSAPP_TEMPLATE_DEAL_CLOSED or None
        params = ["Test Customer", "Test Chemical", "18,000 USD", "PO received — test"]

    ok = send_whatsapp_message(
        text,
        template_name=template,
        template_params=params,
    )
    if not ok:
        raise HTTPException(status_code=502, detail="WhatsApp API rejected the message.")
    return {
        "ok": True,
        "kind": label,
        "message": f"Test {label} WhatsApp notification sent to configured numbers.",
    }


@router.get("/telegram/status")
async def get_telegram_integration_status() -> Dict[str, Any]:
    """Whether Telegram is configured in this app and how backfill works."""
    return {**telegram_status(), "backfill_requirements": backfill_requirements()}


@router.post("/telegram/test")
async def send_test_telegram_notification(
    kind: str = Query(
        "closed",
        description="closed | big_sale | interaction",
    ),
) -> Dict[str, Any]:
    """Send a test celebration (or legacy interaction) message to verify Telegram."""
    if not telegram_configured():
        raise HTTPException(
            status_code=400,
            detail=(
                "Telegram not active. Set TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID, and "
                "NOTIFICATION_ENABLED=true in environment variables."
            ),
        )
    from app.services.telegram_service import (
        format_big_sale_notification,
        format_crm_bot_notification,
        format_deal_closed_notification,
    )

    kind_norm = (kind or "closed").strip().lower()
    if kind_norm in ("big", "big_sale", "sale"):
        text = format_big_sale_notification(
            customer_name="Test Customer",
            product_name="Test Chemical",
            amount=25000,
            unit="kg",
            unit_price=1.2,
            currency="USD",
            value_usd=30000,
            stage="Confirmation",
        )
        label = "big_sale"
    elif kind_norm in ("interaction", "crm"):
        text = format_crm_bot_notification(
            customer_name="Test Customer",
            customer_id="00000000-0000-0000-0000-000000000000",
            input_text="Test user note from LeanChem dashboard",
            ai_response="Test AI response — Telegram integration is connected.",
            created_at=None,
        )
        label = "interaction"
    else:
        text = format_deal_closed_notification(
            customer_name="Test Customer",
            product_name="Test Chemical",
            amount=12000,
            unit="kg",
            unit_price=1.5,
            currency="USD",
            value_usd=18000,
            close_reason="PO received — test celebration",
            owner_hint="Sales team",
        )
        label = "closed"

    ok = send_telegram_message(text)
    if not ok:
        raise HTTPException(status_code=502, detail="Telegram API rejected the message.")
    return {
        "ok": True,
        "kind": label,
        "message": f"Test {label} notification sent to configured chat(s).",
    }


@router.post("/telegram/backfill")
async def run_telegram_backfill(
    dry_run: bool = Query(True, description="Preview only; set false to insert rows"),
    export_path: Optional[str] = Query(
        None,
        description="Absolute path to Telegram Desktop result.json on the server",
    ),
) -> Dict[str, Any]:
    """
    Import CRM messages from Telegram into public.interactions.
    Uses Desktop export JSON if export_path is set; otherwise drains getUpdates queue.
    """
    if export_path:
        try:
            return backfill_from_export_file(export_path, dry_run=dry_run)
        except (FileNotFoundError, ValueError) as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc
    return backfill_from_bot_updates(dry_run=dry_run)


@router.get("/telegram/updates")
async def list_telegram_bot_updates(
    limit: int = Query(50, ge=1, le=100),
    offset: Optional[int] = Query(None, description="Telegram update_id offset for pagination"),
) -> Dict[str, Any]:
    """
    Messages this bot received via getUpdates (not full channel history).
    Use to verify an external Telegram → CRM path or debug a configured bot.
    """
    status = telegram_status()
    if not status.get("bot_token_set"):
        raise HTTPException(
            status_code=400,
            detail="TELEGRAM_BOT_TOKEN is not set on this deployment.",
        )
    updates = fetch_bot_updates(limit=limit, offset=offset)
    return {"count": len(updates), "updates": updates, **status}


@router.get("/customers/{customer_id}/chatgpt-archives")
async def list_customer_chatgpt_archives(
    customer_id: str,
    limit: int = Query(20, ge=1, le=50),
) -> Dict[str, Any]:
    """
    Legacy ChatGPT export rows (metadata.source=conversations_json) that mention
    this customer but were never tagged with metadata.customer_id.
    """
    customer = get_customer_by_id(customer_id)
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
    rows = get_chatgpt_export_archives_for_customer(
        customer_id,
        customer.customer_name,
        max_rows=limit,
    )
    preview: List[Dict[str, Any]] = []
    for row in rows:
        meta = row.get("metadata") or {}
        preview.append(
            {
                "id": row.get("id"),
                "created_at": row.get("created_at"),
                "filename": meta.get("filename"),
                "row_index": meta.get("row_index"),
                "content_chars": len(row.get("content") or ""),
            }
        )
    return {
        "customer_id": customer_id,
        "customer_name": customer.customer_name,
        "count": len(rows),
        "archives": preview,
        "note": (
            "These rows are imported from conversations.json (ChatGPT export), not Telegram. "
            "They are merged into CRM history when the customer name appears in the export text."
        ),
    }
