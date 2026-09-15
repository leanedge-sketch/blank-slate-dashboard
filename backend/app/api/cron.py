"""Vercel Cron entrypoints. Invoked by GET with Authorization: Bearer CRON_SECRET."""

from __future__ import annotations

import hmac
import logging
import os

from fastapi import APIRouter, HTTPException, Request, status

from app.config import settings
from app.services.executive_briefing_service import run_scheduled_executive_briefing

logger = logging.getLogger(__name__)

router = APIRouter()


def _verify_cron_secret(request: Request) -> None:
    secret = (settings.CRON_SECRET or os.getenv("CRON_SECRET") or "").strip()
    if not secret:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="CRON_SECRET is not configured",
        )
    auth = request.headers.get("authorization") or ""
    expected = f"Bearer {secret}"
    if not hmac.compare_digest(auth, expected):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Unauthorized",
        )


@router.get("/cron/executive-briefing")
async def cron_executive_briefing(request: Request):
    """
    Monday executive briefing. Vercel Cron hits this with GET.
    Schedule is daily-safe: the handler no-ops unless it is Monday in
    EXECUTIVE_BRIEFING_TIMEZONE (default Africa/Nairobi).
    """
    _verify_cron_secret(request)
    try:
        result = await run_scheduled_executive_briefing()
        logger.info("Cron executive briefing: %s", result.get("reason") or result.get("email_status"))
        return result
    except Exception as exc:
        logger.exception("Cron executive briefing failed: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Executive briefing cron failed: {exc}",
        )
