"""
Module 8 Phase 2 — executive briefing generation (AI narrative + PDF + email + logs).
"""

from __future__ import annotations

import html
import json
import logging
import time
from datetime import date, datetime, timezone
from typing import Any

from fpdf import FPDF

from app.config import settings
from app.database.connection import get_supabase_client, get_supabase_service_client
from app.models.executive_report import ExecutiveReportSnapshot
from app.services.ai_service import AIServiceError, get_ai_service
from app.services.email_service import EmailAttachment, EmailNotConfiguredError, send_email
from app.services.executive_report_service import get_executive_report_snapshot

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = (
    "You are the Chief Operating Officer of LeanChem. "
    "Based on this week's data provided in the user message as {data_json}, "
    "write a highly professional, 3-paragraph executive summary. "
    "Paragraph 1: Sales Pipeline Health. "
    "Paragraph 2: Import Finance & Transit Value. "
    "Paragraph 3: Critical Stock Alerts. "
    "Use a direct, analytical tone. "
    "CRITICAL: Do NOT invent, estimate, or hallucinate any financial numbers, "
    "deal counts, shipment counts, stock kilograms, or customer counts. "
    "Only use the exact values present in the provided data_json payload. "
    "If a section has no rows, say so explicitly."
)


def parse_executive_recipients() -> list[str]:
    # Prefer EXECUTIVE_TEAM_EMAIL (spec), fall back to EXECUTIVE_REPORT_RECIPIENTS.
    raw = (
        (getattr(settings, "EXECUTIVE_TEAM_EMAIL", "") or "").strip()
        or (settings.EXECUTIVE_REPORT_RECIPIENTS or "").strip()
    )
    if not raw:
        return []
    return [part.strip() for part in raw.split(",") if part.strip()]


def refresh_executive_views() -> None:
    """Call the Postgres refresh RPC so Monday briefings use fresh rollups."""
    try:
        client = get_supabase_service_client()
    except Exception:
        client = get_supabase_client()
    client.rpc("refresh_executive_materialized_views").execute()


def _snapshot_payload(snapshot: ExecutiveReportSnapshot) -> dict[str, Any]:
    return {
        "as_of": datetime.now(timezone.utc).isoformat(),
        "financials": {
            "sales_summary": [row.model_dump(mode="json") for row in snapshot.sales_summary],
            "transit_summary": [
                row.model_dump(mode="json") for row in snapshot.transit_summary
            ],
        },
        "stock_alerts": [row.model_dump(mode="json") for row in snapshot.stock_alerts],
        "crm_activity": (
            snapshot.crm_activity.model_dump(mode="json") if snapshot.crm_activity else None
        ),
    }


def build_briefing_prompt(snapshot: ExecutiveReportSnapshot) -> str:
    payload = _snapshot_payload(snapshot)
    return (
        "Write this week's LeanChem executive briefing using ONLY these exact values "
        f"(data_json):\n\n{json.dumps(payload, indent=2, default=str)}"
    )


def _safe_pdf_text(value: object) -> str:
    text = str(value or "")
    return text.encode("latin-1", errors="replace").decode("latin-1")


class _ExecutiveBriefingPDF(FPDF):
    def header(self) -> None:
        self.set_font("Helvetica", "B", 14)
        self.cell(0, 10, "LeanChem Executive Briefing", new_x="LMARGIN", new_y="NEXT", align="C")
        self.set_font("Helvetica", "", 9)
        self.cell(
            0,
            6,
            f"Generated {date.today().isoformat()} · Materialized-view rollups",
            new_x="LMARGIN",
            new_y="NEXT",
            align="C",
        )
        self.ln(4)

    def section_title(self, title: str) -> None:
        self.set_font("Helvetica", "B", 11)
        self.cell(0, 8, _safe_pdf_text(title), new_x="LMARGIN", new_y="NEXT")
        self.set_font("Helvetica", "", 10)

    def body_paragraph(self, text: str) -> None:
        self.multi_cell(0, 5, _safe_pdf_text(text))
        self.ln(2)


def build_executive_briefing_pdf(
    *,
    narrative: str,
    snapshot: ExecutiveReportSnapshot,
    provider_used: str,
    model_used: str | None = None,
) -> bytes:
    pdf = _ExecutiveBriefingPDF()
    pdf.set_auto_page_break(auto=True, margin=15)
    pdf.add_page()

    pdf.section_title("COO executive summary")
    pdf.body_paragraph(narrative.strip() or "No narrative generated.")
    pdf.ln(2)

    pdf.section_title("Sales pipeline (mv_exec_sales_summary)")
    if not snapshot.sales_summary:
        pdf.body_paragraph("No sales summary rows.")
    else:
        for row in snapshot.sales_summary:
            currency = row.currency or "n/a"
            pdf.body_paragraph(
                f"- {row.stage} · {currency}: {row.total_deals} deals · "
                f"${row.pipeline_value_usd:,.0f} pipeline"
            )

    pdf.section_title("Transit (mv_exec_transit_summary)")
    if not snapshot.transit_summary:
        pdf.body_paragraph("No in-transit summary rows.")
    else:
        for row in snapshot.transit_summary:
            pdf.body_paragraph(
                f"- {row.status}: {row.active_shipments} shipments · "
                f"{row.total_transit_value:,.0f} transit value"
            )

    pdf.section_title("Stock alerts (mv_exec_stock_alerts)")
    if not snapshot.stock_alerts:
        pdf.body_paragraph("No critical stock alerts.")
    else:
        for row in snapshot.stock_alerts[:15]:
            pdf.body_paragraph(
                f"- {row.product_name} @ {row.location}: "
                f"{row.available_kg:,.0f} kg available vs threshold "
                f"{row.minimum_stock_threshold:,.0f} kg"
            )

    if snapshot.crm_activity:
        pdf.section_title("CRM activity (mv_exec_crm_activity)")
        pdf.body_paragraph(
            f"- New customers (7d): {snapshot.crm_activity.new_customers_7d}; "
            f"Interactions (7d): {snapshot.crm_activity.interactions_7d}; "
            f"Total customers: {snapshot.crm_activity.total_customers}"
        )

    pdf.ln(2)
    pdf.set_font("Helvetica", "I", 8)
    model_label = model_used or "n/a"
    pdf.cell(
        0,
        5,
        _safe_pdf_text(f"Provider: {provider_used} · Model: {model_label}"),
        new_x="LMARGIN",
        new_y="NEXT",
    )
    return bytes(pdf.output())


def _html_email(narrative: str, snapshot: ExecutiveReportSnapshot) -> str:
    sales_rows = "".join(
        (
            "<li>"
            f"<strong>{html.escape(row.stage)}</strong>"
            f" ({html.escape(row.currency or 'n/a')}): "
            f"{row.total_deals} deals · ${row.pipeline_value_usd:,.0f}"
            "</li>"
        )
        for row in snapshot.sales_summary
    ) or "<li>No sales rows</li>"
    transit_rows = "".join(
        (
            "<li>"
            f"<strong>{html.escape(row.status)}</strong>: "
            f"{row.active_shipments} shipments · {row.total_transit_value:,.0f}"
            "</li>"
        )
        for row in snapshot.transit_summary
    ) or "<li>No transit rows</li>"
    stock_rows = "".join(
        (
            "<li>"
            f"<strong>{html.escape(row.product_name)}</strong> "
            f"({html.escape(row.location)}): "
            f"{row.available_kg:,.0f} kg / threshold {row.minimum_stock_threshold:,.0f} kg"
            "</li>"
        )
        for row in snapshot.stock_alerts[:15]
    ) or "<li>No critical stock alerts</li>"

    crm_block = ""
    if snapshot.crm_activity:
        crm_block = (
            "<h3>CRM activity</h3>"
            f"<p>New customers (7d): {snapshot.crm_activity.new_customers_7d} · "
            f"Interactions (7d): {snapshot.crm_activity.interactions_7d} · "
            f"Total customers: {snapshot.crm_activity.total_customers}</p>"
        )

    safe_narrative = html.escape(narrative).replace("\n", "<br/>")
    return f"""
    <div style="font-family:Segoe UI,Arial,sans-serif;color:#0f172a;line-height:1.5">
      <h2 style="margin:0 0 12px">LeanChem Monday Executive Briefing</h2>
      <p style="margin:0 0 16px;color:#475569">
        Automated COO summary from materialized-view rollups. PDF attached.
      </p>
      <h3>Narrative</h3>
      <p>{safe_narrative}</p>
      <h3>Sales roll-up</h3>
      <ul>{sales_rows}</ul>
      <h3>Transit roll-up</h3>
      <ul>{transit_rows}</ul>
      <h3>Stock alerts</h3>
      <ul>{stock_rows}</ul>
      {crm_block}
    </div>
    """


def _log_briefing(
    *,
    summary_text: str,
    summary_html: str,
    data_json: dict[str, Any],
    provider_used: str,
    model_used: str,
    is_fallback: bool,
    email_status: str,
    email_error: str | None,
    recipients: list[str],
) -> None:
    payload = {
        "summary_text": summary_text,
        "summary_html": summary_html,
        "data_json": data_json,
        "provider_used": provider_used,
        "model_used": model_used or None,
        "is_fallback": is_fallback,
        "email_status": email_status,
        "email_error": email_error,
        "recipients": recipients,
    }
    try:
        client = get_supabase_service_client()
        client.table("executive_briefing_logs").insert(payload).execute()
    except Exception as exc:
        logger.warning("executive_briefing_logs insert failed: %s", exc)


def _send_with_retry(
    *,
    recipients: list[str],
    subject: str,
    html_body: str,
    text_body: str,
    pdf_bytes: bytes,
    stamp: str,
    max_attempts: int = 2,
) -> tuple[bool, str | None]:
    last_error: str | None = None
    for attempt in range(1, max_attempts + 1):
        try:
            send_email(
                to=recipients,
                subject=subject,
                html=html_body,
                text=text_body,
                attachments=[
                    EmailAttachment(
                        filename=f"leanchem-executive-briefing-{stamp}.pdf",
                        content=pdf_bytes,
                        content_type="application/pdf",
                    )
                ],
            )
            return True, None
        except EmailNotConfiguredError as exc:
            return False, str(exc)
        except Exception as exc:
            last_error = str(exc)
            logger.warning(
                "Executive briefing email attempt %s/%s failed: %s",
                attempt,
                max_attempts,
                exc,
            )
            if attempt < max_attempts:
                time.sleep(2 * attempt)
    return False, last_error


async def generate_executive_briefing_narrative(
    snapshot: ExecutiveReportSnapshot,
) -> dict[str, Any]:
    prompt = build_briefing_prompt(snapshot)
    result = await get_ai_service().generate_text(
        prompt=prompt,
        system_instruction=SYSTEM_PROMPT,
        task_type="executive_briefing",  # DEEP_REASONING_RAG via AIService
        timeout_seconds=60.0,
        max_tokens=1200,
        gemini_model=settings.EXECUTIVE_BRIEFING_GEMINI_MODEL or "gemini-3.1-pro-preview",
    )
    return result


async def run_executive_briefing(*, send: bool = True) -> dict[str, Any]:
    """
    Refresh MVs → AI narrative (Gemini 2.5 Pro → GPT-4o) → PDF → email → log.
    Email failures are caught and logged; they must never crash the worker.
    """
    recipients = parse_executive_recipients()
    if send and not recipients:
        raise RuntimeError(
            "EXECUTIVE_TEAM_EMAIL / EXECUTIVE_REPORT_RECIPIENTS is empty. "
            "Add leadership emails before sending."
        )

    try:
        refresh_executive_views()
    except Exception as exc:
        logger.warning("MV refresh failed (continuing with last snapshot): %s", exc)

    snapshot = get_executive_report_snapshot()
    data_json = _snapshot_payload(snapshot)

    try:
        ai_result = await generate_executive_briefing_narrative(snapshot)
        narrative = (ai_result.get("content") or "").strip()
        provider_used = str(ai_result.get("provider_used") or "unknown")
        model_used = str(ai_result.get("model_used") or "")
        is_fallback = bool(ai_result.get("is_fallback"))
    except AIServiceError as exc:
        logger.warning("Executive briefing AI failed; using deterministic fallback: %s", exc)
        narrative = (
            "AI narrative unavailable this week. Deterministic rollups from the "
            "materialized views are attached below and in the PDF for leadership review."
        )
        provider_used = "deterministic"
        model_used = ""
        is_fallback = True

    pdf_bytes = build_executive_briefing_pdf(
        narrative=narrative,
        snapshot=snapshot,
        provider_used=provider_used,
        model_used=model_used or None,
    )
    html_body = _html_email(narrative, snapshot)

    emailed = False
    email_error: str | None = None
    email_status = "skipped"
    if send:
        stamp = date.today().isoformat()
        emailed, email_error = _send_with_retry(
            recipients=recipients,
            subject=f"LeanChem Executive Briefing — week of {stamp}",
            html_body=html_body,
            text_body=narrative,
            pdf_bytes=pdf_bytes,
            stamp=stamp,
        )
        email_status = "sent" if emailed else "failed"
        if not emailed:
            logger.error("Executive briefing email failed after retries: %s", email_error)

    _log_briefing(
        summary_text=narrative,
        summary_html=html_body,
        data_json=data_json,
        provider_used=provider_used,
        model_used=model_used,
        is_fallback=is_fallback,
        email_status=email_status,
        email_error=email_error,
        recipients=recipients if send else [],
    )

    return {
        "ok": True,
        "emailed": emailed,
        "recipients": recipients if emailed else [],
        "provider_used": provider_used,
        "model_used": model_used,
        "is_fallback": is_fallback,
        "narrative_chars": len(narrative),
        "pdf_bytes": len(pdf_bytes),
        "email_status": email_status,
        "email_error": email_error,
        "sales_rows": len(snapshot.sales_summary),
        "transit_rows": len(snapshot.transit_summary),
        "stock_alert_rows": len(snapshot.stock_alerts),
    }


# Spec alias used by the Monday worker.
generate_weekly_executive_briefing = run_executive_briefing
