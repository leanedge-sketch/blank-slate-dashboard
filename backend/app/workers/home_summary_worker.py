"""
Home At a Glance worker — APScheduler every 15 minutes.

Aggregates SQL metrics, synthesizes 3 bullets via AIService (Gemini → OpenAI),
and writes home_summary_cache. Page loads never call this path.
"""

from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Optional

from apscheduler.schedulers.asyncio import AsyncIOScheduler

from app.database.connection import get_supabase_service_client
from app.services.ai_service import AIServiceError, get_ai_service
from app.services.home_summary_service import build_ai_prompt, collect_home_metrics, format_live_ledger_markdown

logger = logging.getLogger(__name__)

_scheduler: Optional[AsyncIOScheduler] = None


async def refresh_home_summary() -> Optional[Dict[str, Any]]:
    """Scheduled job: SQL counts → AIService.generate_text(timeout=4s) → cache."""
    metrics = collect_home_metrics()
    markdown = format_live_ledger_markdown(metrics)
    provider = "gemini"
    is_fallback = False
    try:
        result = await get_ai_service().generate_text(
            prompt=build_ai_prompt(metrics),
            system_instruction="",
            task_type="general",
            timeout_seconds=4.0,
            max_tokens=180,
        )
        content = (result.get("content") or "").strip()
        if content:
            markdown = content
        provider = result.get("provider_used") or "gemini"
        is_fallback = bool(result.get("is_fallback"))
        if is_fallback:
            logger.warning("Home summary used OpenAI fallback")
    except AIServiceError as exc:
        logger.warning("Home summary AI failed; caching SQL ledger text: %s", exc)
        provider = "sql"
        is_fallback = True

    now = datetime.now(timezone.utc)
    payload = {
        "summary_markdown": markdown,
        "metrics_payload": metrics,
        "provider_used": provider,
        "is_fallback": is_fallback,
        "expires_at": (now + timedelta(minutes=15)).isoformat(),
    }
    try:
        supabase = get_supabase_service_client()
        resp = supabase.table("home_summary_cache").insert(payload).execute()
        row = (resp.data or [payload])[0]
        logger.info("home_summary_cache refreshed via %s", provider)
        return row
    except Exception as exc:
        logger.warning("home_summary_cache insert failed: %s", exc)
        return payload


def start_home_summary_scheduler() -> AsyncIOScheduler:
    """Start APScheduler: first run shortly after boot, then every 15 minutes."""
    global _scheduler
    if _scheduler is not None:
        return _scheduler
    scheduler = AsyncIOScheduler()
    scheduler.add_job(
        refresh_home_summary,
        "interval",
        minutes=15,
        id="home_summary_refresh",
        replace_existing=True,
        max_instances=1,
        coalesce=True,
        misfire_grace_time=120,
    )
    scheduler.add_job(
        refresh_home_summary,
        "date",
        run_date=datetime.now(timezone.utc) + timedelta(seconds=5),
        id="home_summary_refresh_once",
        replace_existing=True,
    )
    scheduler.start()
    _scheduler = scheduler
    logger.info("APScheduler started for home_summary_refresh (every 15 minutes)")
    return scheduler


def shutdown_home_summary_scheduler() -> None:
    global _scheduler
    if _scheduler is None:
        return
    try:
        _scheduler.shutdown(wait=False)
    except Exception:
        pass
    _scheduler = None
