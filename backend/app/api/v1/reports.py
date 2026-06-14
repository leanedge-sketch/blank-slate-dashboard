"""Unified reporting API — CRM, PMS, stock, and sales pipeline."""

from fastapi import APIRouter, HTTPException, Query

from app.models.integrated_report import IntegratedReportSnapshot
from app.services.integrated_report_service import get_integrated_report_snapshot

router = APIRouter()


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
