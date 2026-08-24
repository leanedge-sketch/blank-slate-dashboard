"""
AI provider config, token pricing, and Telegram telemetry.

Reads GEMINI_*, OPENAI_*, TELEGRAM_*, and NOTIFICATION_ENABLED from the
existing Settings / environment.
"""

from __future__ import annotations

import logging
from typing import Any, Optional

import httpx

from app.config import settings

logger = logging.getLogger(__name__)

TELEGRAM_SEND_URL = "https://api.telegram.org/bot{token}/sendMessage"

# USD per 1M tokens
GEMINI_FLASH_INPUT_PER_M = 0.30
GEMINI_FLASH_OUTPUT_PER_M = 2.50
GPT4O_MINI_INPUT_PER_M = 0.15
GPT4O_MINI_OUTPUT_PER_M = 0.60
GPT4O_INPUT_PER_M = 2.50
GPT4O_OUTPUT_PER_M = 10.00

BUDGET_WARN_RATIO = 0.75
BUDGET_HIGH_RATIO = 0.90
BUDGET_CAP_RATIO = 1.0


def gemini_api_key() -> str:
    return (settings.GEMINI_API_KEY or "").strip()


def openai_api_key() -> str:
    return (settings.OPENAI_API_KEY or "").strip()


def gemini_chat_model() -> str:
    return (settings.GEMINI_CHAT_MODEL or "gemini-3.1-pro-preview").strip()


def openai_chat_model() -> str:
    return (
        settings.MODEL_CHOICE or settings.OPENAI_CHAT_MODEL or "gpt-4o"
    ).strip()


def notifications_enabled() -> bool:
    return bool(settings.NOTIFICATION_ENABLED)


def telegram_bot_token() -> str:
    return (settings.TELEGRAM_BOT_TOKEN or "").strip()


def telegram_chat_ids() -> list[str]:
    return [c.strip() for c in (settings.TELEGRAM_CHAT_ID or "").split(",") if c.strip()]


# Gemini 3.1 Pro preview (paid) — USD per 1M tokens, prompts ≤ 200k
GEMINI_PRO_INPUT_PER_M = 2.00
GEMINI_PRO_OUTPUT_PER_M = 12.00


def _rates_for_model(model: str) -> tuple[float, float]:
    name = (model or "").lower()
    if "gpt-4o-mini" in name:
        return GPT4O_MINI_INPUT_PER_M, GPT4O_MINI_OUTPUT_PER_M
    if "gpt-4o" in name:
        return GPT4O_INPUT_PER_M, GPT4O_OUTPUT_PER_M
    if "gemini" in name and "pro" in name:
        return GEMINI_PRO_INPUT_PER_M, GEMINI_PRO_OUTPUT_PER_M
    if "gemini" in name:
        return GEMINI_FLASH_INPUT_PER_M, GEMINI_FLASH_OUTPUT_PER_M
    return GEMINI_FLASH_INPUT_PER_M, GEMINI_FLASH_OUTPUT_PER_M


def estimate_cost_usd(
    model: str,
    input_tokens: int,
    output_tokens: int,
) -> float:
    in_rate, out_rate = _rates_for_model(model)
    cost = (max(input_tokens, 0) / 1_000_000.0) * in_rate + (
        max(output_tokens, 0) / 1_000_000.0
    ) * out_rate
    return round(cost, 6)


def parse_setting_value(raw: Any) -> Any:
    """Normalize jsonb values returned by PostgREST."""
    if isinstance(raw, dict) and "value" in raw and len(raw) <= 2:
        return parse_setting_value(raw.get("value"))
    return raw


def setting_as_bool(raw: Any, default: bool = False) -> bool:
    value = parse_setting_value(raw)
    if value is None:
        return default
    if isinstance(value, bool):
        return value
    if isinstance(value, (int, float)):
        return bool(value)
    text = str(value).strip().lower()
    if text in ("true", "1", "yes", "on"):
        return True
    if text in ("false", "0", "no", "off"):
        return False
    return default


def setting_as_float(raw: Any, default: float = 0.0) -> float:
    value = parse_setting_value(raw)
    if value is None:
        return default
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


async def send_telegram_alert(message: str) -> bool:
    """
    POST to Telegram Bot API when a bot token and chat id are configured.
    Never raises; failures are logged.
    """
    token = telegram_bot_token()
    chat_ids = telegram_chat_ids()
    if not token or not chat_ids:
        logger.debug("Telegram alert skipped: missing TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID")
        return False
    if not notifications_enabled():
        logger.debug("Telegram alert skipped: NOTIFICATION_ENABLED is false")
        return False

    url = TELEGRAM_SEND_URL.format(token=token)
    ok_any = False
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            for chat_id in chat_ids:
                try:
                    resp = await client.post(
                        url,
                        json={"chat_id": chat_id, "text": message},
                    )
                    if resp.status_code >= 400:
                        logger.warning(
                            "Telegram alert HTTP %s: %s",
                            resp.status_code,
                            resp.text[:300],
                        )
                        continue
                    data = resp.json()
                    if data.get("ok"):
                        ok_any = True
                    else:
                        logger.warning("Telegram alert rejected: %s", data)
                except Exception as exc:
                    logger.warning("Telegram alert failed for chat %s: %s", chat_id, exc)
    except Exception as exc:
        logger.warning("Telegram alert client error: %s", exc)
    return ok_any


def budget_alert_level(spend: float, cap: float) -> int:
    """0 = under warn, 75 = at/over 75%, 90 = at/over 90%, 100 = at/over 100%."""
    if cap <= 0:
        return 0
    ratio = spend / cap
    if ratio >= BUDGET_CAP_RATIO:
        return 100
    if ratio >= BUDGET_HIGH_RATIO:
        return 90
    if ratio >= BUDGET_WARN_RATIO:
        return 75
    return 0


async def check_budget_and_alert(
    current_month_spend_usd: float,
    monthly_budget_cap_usd: float,
    last_alert_level: int = 0,
) -> int:
    """
    Fire Telegram alerts at 75% and 90% of the Gemini monthly cap.
    Returns the highest level that has been alerted (for persistence).
    """
    level = budget_alert_level(current_month_spend_usd, monthly_budget_cap_usd)
    if level <= last_alert_level:
        return last_alert_level

    cap = monthly_budget_cap_usd
    spend = current_month_spend_usd
    pct = (spend / cap * 100.0) if cap > 0 else 0.0

    if last_alert_level < 100 <= level:
        await send_telegram_alert(
            f"🚨 Gemini monthly budget cap reached. Spend ${spend:.2f} / ${cap:.2f} "
            f"({pct:.0f}%)."
        )
    if last_alert_level < 75 <= level:
        await send_telegram_alert(
            f"⚠️ Gemini spend at {pct:.0f}% of monthly budget "
            f"(${spend:.2f} / ${cap:.2f}). Alert threshold: 75%."
        )
    if last_alert_level < 90 <= level:
        await send_telegram_alert(
            f"🚨 Gemini spend at {pct:.0f}% of monthly budget "
            f"(${spend:.2f} / ${cap:.2f}). Alert threshold: 90%."
        )
    return max(last_alert_level, level)
