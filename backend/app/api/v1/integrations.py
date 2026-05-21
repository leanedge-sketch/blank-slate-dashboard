"""
External integration diagnostics (Telegram, legacy archives).
"""

from typing import Any, Dict, List, Optional

from fastapi import APIRouter, HTTPException, Query

from app.services.crm_service import get_customer_by_id
from app.services.conversation_archive_service import (
    get_chatgpt_export_archives_for_customer,
)
from app.services.telegram_backfill_service import (
    backfill_from_bot_updates,
    backfill_from_export_file,
    backfill_requirements,
)
from app.services.telegram_service import fetch_bot_updates, telegram_status

router = APIRouter(prefix="/integrations", tags=["integrations"])


@router.get("/telegram/status")
async def get_telegram_integration_status() -> Dict[str, Any]:
    """Whether Telegram is configured in this app and how backfill works."""
    return {**telegram_status(), "backfill_requirements": backfill_requirements()}


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
