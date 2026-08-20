"""Unified reporting API — CRM, PMS, stock, sales pipeline, and executive views."""

from fastapi import APIRouter, HTTPException, Query

from app.models.executive_report import ExecutiveReportSnapshot
from app.models.integrated_report import IntegratedReportSnapshot
from app.services.executive_briefing_service import run_executive_briefing
from app.services.executive_report_service import get_executive_report_snapshot
from app.services.integrated_report_service import get_integrated_report_snapshot

router = APIRouter()


@router.get("/reports/executive-summary", response_model=ExecutiveReportSnapshot)
@router.get("/reports/executive", response_model=ExecutiveReportSnapshot)
async def get_executive_summary_endpoint():
    """
    Fast executive snapshot: SELECT from materialized views only.
    financials (sales + transit), stock_alerts, crm_activity.
    """
    try:
        return get_executive_report_snapshot()
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error building executive report snapshot: {str(e)}",
        )


@router.post("/reports/executive/briefing/run")
async def run_executive_briefing_endpoint(
    send: bool = Query(
        True,
        description="If true, email leadership. If false, generate AI narrative + PDF only.",
    ),
):
    """
    Manual trigger for Module 8 Phase 2 Monday briefing pipeline.
    """
    try:
        return await run_executive_briefing(send=send)
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error running executive briefing: {str(e)}",
        )


@router.get("/reports/integrated", response_model=IntegratedReportSnapshot)
async def get_integrated_report_endpoint(
    days_back: int = Query(90, ge=7, le=365, description="Pipeline lookback for product demand"),
):
    """
    Cross-module snapshot: stock availability, PMS catalog/pricing, pipeline fulfillment
    risks, and CRM↔PMS↔stock link counts.
    """
    try:
        return get_integrated_report_snapshot(days_back=days_back)
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error building integrated report: {str(e)}",
        )
