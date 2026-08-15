"""
Loop B — Supplier Sourcing Engine.

POST /api/sourcing/request  { "rfqId": "<uuid>" }
"""
from __future__ import annotations

import logging
from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.database.loop_a import get_loop_a_supabase
from app.services.email_service import EmailNotConfiguredError, send_email
from app.config import settings

logger = logging.getLogger(__name__)
router = APIRouter()


class SourcingRequestBody(BaseModel):
    rfqId: str = Field(..., min_length=1)


def _format_items(items: list[Any]) -> str:
    if not items:
        return "No chemical lines listed."
    parts: list[str] = []
    for item in items:
        if not isinstance(item, dict):
            continue
        name = str(item.get("name") or "Unknown chemical")
        cas = item.get("casNumber")
        qty = item.get("quantity")
        piece = name
        if cas:
            piece += f" (CAS {cas})"
        if qty:
            piece += f" — {qty}"
        parts.append(piece)
    return "; ".join(parts) if parts else "No chemical lines listed."


@router.post("/request")
def request_supplier_pricing(body: SourcingRequestBody):
    """
    Anonymized supplier pricing blast for a public-site RFQ.
    Buyer contact fields are never included in the outbound email.
    """
    try:
        supabase = get_loop_a_supabase()
    except RuntimeError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    # Load RFQ — select only non-buyer fields for the blast payload.
    result = (
        supabase.table("rfqs")
        .select(
            "id, reference, volume, unit, packaging, incoterms, target_delivery_date, items, status"
        )
        .eq("id", body.rfqId)
        .limit(1)
        .execute()
    )
    rows = result.data or []
    if not rows:
        raise HTTPException(status_code=404, detail="RFQ not found.")

    rfq = rows[0]
    # Explicitly strip buyer identity (never select contact_name / company_name / email / phone).
    items = rfq.get("items") if isinstance(rfq.get("items"), list) else []
    volume = f"{rfq.get('volume')} {rfq.get('unit')}"
    packaging = str(rfq.get("packaging") or "")
    target_delivery = str(rfq.get("target_delivery_date") or "Not specified")
    incoterms = str(rfq.get("incoterms") or "—")
    item_list = _format_items(items)

    suppliers_result = (
        supabase.table("suppliers").select("email, name").eq("active", True).execute()
    )
    emails = [
        str(s.get("email") or "").strip()
        for s in (suppliers_result.data or [])
        if s.get("email")
    ]
    if not emails:
        raise HTTPException(
            status_code=400,
            detail="No active supplier emails found in the suppliers table.",
        )

    subject = f"LeanChem RFQ: Pricing Request for {volume} of Chemical Items"
    text = (
        "Please provide CIF Djibouti pricing for the following items:\n"
        f"{item_list}\n\n"
        f"Required packaging: {packaging}\n"
        f"Target delivery: {target_delivery}\n"
        f"Incoterms preference: {incoterms}\n\n"
        "Please reply directly to this email with your quote.\n\n"
        "Note: Buyer identity is confidential and has been withheld from this request."
    )
    html = f"""
    <div style="font-family:Montserrat,Arial,sans-serif;color:#222235;line-height:1.55">
      <p>Please provide <strong>CIF Djibouti</strong> pricing for the following items:</p>
      <p><strong>{item_list}</strong></p>
      <ul>
        <li><strong>Required packaging:</strong> {packaging}</li>
        <li><strong>Target delivery:</strong> {target_delivery}</li>
        <li><strong>Incoterms preference:</strong> {incoterms}</li>
      </ul>
      <p>Please reply directly to this email with your quote.</p>
      <p style="color:#7B8DC6;font-size:13px">
        Buyer details are confidential and have been withheld from this request.
      </p>
    </div>
    """

    # Resend requires a primary `to`; use from-address and BCC suppliers.
    from_addr = settings.EMAIL_FROM or "LeanChem <onboarding@resend.dev>"
    primary_to = from_addr
    if "<" in from_addr and ">" in from_addr:
        primary_to = from_addr.split("<", 1)[1].split(">", 1)[0].strip()

    try:
        send_email(
            to=primary_to,
            bcc=emails,
            subject=subject,
            html=html,
            text=text,
            reply_to=settings.RESEND_REPLY_TO or None,
        )
    except EmailNotConfiguredError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    except Exception as exc:
        logger.exception("Supplier pricing email failed")
        raise HTTPException(
            status_code=500, detail=f"Failed to send supplier email: {exc}"
        ) from exc

    update = (
        supabase.table("rfqs")
        .update({"status": "under_review"})
        .eq("id", body.rfqId)
        .execute()
    )
    if update.data is None and getattr(update, "error", None):
        raise HTTPException(
            status_code=500,
            detail="Supplier email sent, but RFQ status update failed.",
        )

    return {
        "success": True,
        "rfqId": body.rfqId,
        "status": "under_review",
        "supplierCount": len(emails),
    }
