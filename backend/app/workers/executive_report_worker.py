"""
Module 8 Phase 2 worker — Monday 08:00 executive briefing.

Spec name: executive_report_worker / generate_weekly_executive_briefing
"""

from __future__ import annotations

import logging
from typing import Any, Optional

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger

from app.config import settings
from app.services.executive_briefing_service import (
    generate_weekly_executive_briefing,
    parse_executive_recipients,
)

logger = logging.getLogger(__name__)

_scheduler: Optional[AsyncIOScheduler] = None


async def generate_weekly_executive_briefing_job() -> Optional[dict[str, Any]]:
    """APScheduler entrypoint with full try/catch so failures never crash the API."""
    try:
        if not settings.EXECUTIVE_BRIEFING_ENABLED:
            logger.info("Executive briefing worker disabled (EXECUTIVE_BRIEFING_ENABLED=false)")
            return None
        if not parse_executive_recipients():
            logger.warning(
                "Skipping Monday executive briefing: no EXECUTIVE_TEAM_EMAIL / "
                "EXECUTIVE_REPORT_RECIPIENTS configured"
            )
            return None
        result = await generate_weekly_executive_briefing(send=True)
        logger.info(
            "Monday executive briefing complete: emailed=%s provider=%s status=%s",
            result.get("emailed"),
            result.get("provider_used"),
            result.get("email_status"),
        )
        return result
    except Exception as exc:
        logger.exception("Monday executive briefing failed (non-fatal): %s", exc)
        return None


# Back-compat aliases used by main.py / older imports
run_monday_executive_briefing = generate_weekly_executive_briefing_job


def start_executive_briefing_scheduler() -> AsyncIOScheduler:
    """Cron: every Monday at 08:00 in EXECUTIVE_BRIEFING_TIMEZONE (default Africa/Nairobi)."""
    global _scheduler
    if _scheduler is not None:
        return _scheduler

    timezone = (settings.EXECUTIVE_BRIEFING_TIMEZONE or "Africa/Nairobi").strip()
    scheduler = AsyncIOScheduler(timezone=timezone)
    scheduler.add_job(
        generate_weekly_executive_briefing_job,
        CronTrigger(day_of_week="mon", hour=8, minute=0, timezone=timezone),
        id="executive_briefing_monday",
        replace_existing=True,
        max_instances=1,
        coalesce=True,
        misfire_grace_time=3600,
    )
    scheduler.start()
    _scheduler = scheduler
    logger.info(
        "APScheduler started for generate_weekly_executive_briefing (Mon 08:00 %s)",
        timezone,
    )
    return scheduler


def shutdown_executive_briefing_scheduler() -> None:
    global _scheduler
    if _scheduler is None:
        return
    try:
        _scheduler.shutdown(wait=False)
    except Exception:
        pass
    _scheduler = None


# Spec filename alias helpers
start_executive_report_scheduler = start_executive_briefing_scheduler
shutdown_executive_report_scheduler = shutdown_executive_briefing_scheduler
