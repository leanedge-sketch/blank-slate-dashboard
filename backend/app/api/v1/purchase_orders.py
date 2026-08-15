"""
Loop C — Logistics Tracking.

POST /api/po/update  { "poId": "<uuid>", "stage": "Ocean Transit" }
"""
from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.database.loop_a import get_loop_a_supabase
from app.services.email_service import EmailNotConfiguredError, send_email

logger = logging.getLogger(__name__)
router = APIRouter()

LOGISTICS_STAGES = (
    "Origin Port",
    "Ocean Transit",
    "Djibouti Customs",
    "Modjo Dry Port",
    "Addis Delivery",
)


class PoUpdateBody(BaseModel):
    poId: str = Field(..., min_length=1)
    stage: str = Field(..., min_length=1)


def _escape(value: str) -> str:
    return (
        value.replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace('"', "&quot;")
    )


@router.post("/update")
def update_purchase_order_stage(body: PoUpdateBody) -> dict[str, Any]:
    """Update PO corridor stage and notify the buyer via Resend."""
    if body.stage not in LOGISTICS_STAGES:
        raise HTTPException(
            status_code=400,
            detail=f"stage must be one of: {', '.join(LOGISTICS_STAGES)}",
        )

    try:
        supabase = get_loop_a_supabase()
    except RuntimeError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    existing = (
        supabase.table("purchase_orders")
        .select("id, po_number, buyer_email, current_stage")
        .eq("id", body.poId)
        .limit(1)
        .execute()
    )
    rows = existing.data or []
    if not rows:
        raise HTTPException(status_code=404, detail="Purchase order not found.")

    po = rows[0]
    last_updated = datetime.now(timezone.utc).isoformat()

    updated = (
        supabase.table("purchase_orders")
        .update({"current_stage": body.stage, "last_updated": last_updated})
        .eq("id", body.poId)
        .select("id, po_number, buyer_email, current_stage, last_updated, rfq_id")
        .execute()
    )
    updated_rows = updated.data or []
    if not updated_rows:
        raise HTTPException(status_code=500, detail="Failed to update purchase order stage.")

    row = updated_rows[0]
    display_id = row.get("po_number") or row.get("id") or body.poId
    buyer_email = str(row.get("buyer_email") or po.get("buyer_email") or "").strip()

    if buyer_email:
        subject = f"LeanChem Logistics Update: PO #{display_id}"
        text = (
            f"Your purchase order has moved to a new stage: {body.stage}. "
            "You can track this live in your client portal."
        )
        html = f"""
        <div style="font-family:Montserrat,Arial,sans-serif;color:#222235;line-height:1.55">
          <p>Your purchase order <strong>#{_escape(str(display_id))}</strong> has moved to a new stage:</p>
          <p style="font-size:18px;font-weight:700;color:#1E5897">{_escape(body.stage)}</p>
          <p>You can track this live in your client portal.</p>
        </div>
        """
        try:
            send_email(to=buyer_email, subject=subject, html=html, text=text)
        except EmailNotConfiguredError:
            logger.warning("Email not configured — PO stage updated without buyer notification.")
        except Exception:
            logger.exception("Buyer logistics email failed (stage already saved)")

    return {
        "success": True,
        "poId": row.get("id") or body.poId,
        "poNumber": row.get("po_number"),
        "rfqId": row.get("rfq_id"),
        "currentStage": row.get("current_stage") or body.stage,
        "lastUpdated": row.get("last_updated") or last_updated,
        "buyerEmail": buyer_email,
    }
