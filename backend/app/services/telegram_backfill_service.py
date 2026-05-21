"""
Backfill public.interactions from Telegram (Bot API queue or Desktop export JSON).

Limitations (Telegram Bot API):
- getUpdates only returns updates the bot has NOT yet acknowledged (often empty if a
  webhook or poller already consumed them; Telegram drops unacked updates after ~24h).
- Bots cannot read arbitrary group/channel history via Bot API.

For full history, export the chat from Telegram Desktop and pass the JSON path.
"""

from __future__ import annotations

import json
import logging
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

from app.database.connection import get_supabase_service_client
from app.services.crm_service import search_customers_by_name
from app.services.telegram_service import _post_telegram


def _interaction_fingerprint(input_text: str, ai_response: str) -> str:
    return f"{(input_text or '').strip()[:180]}|{(ai_response or '').strip()[:180]}"

logger = logging.getLogger(__name__)

UUID_RE = re.compile(
    r"[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}",
    re.IGNORECASE,
)


class ParsedTelegramMessage:
    def __init__(
        self,
        *,
        text: str,
        message_date: Optional[datetime],
        chat_id: Optional[str],
        message_id: Optional[int],
        customer_id: Optional[str],
        customer_name: Optional[str],
        input_text: str,
        ai_response: str,
        raw: Dict[str, Any],
    ) -> None:
        self.text = text
        self.message_date = message_date
        self.chat_id = chat_id
        self.message_id = message_id
        self.customer_id = customer_id
        self.customer_name = customer_name
        self.input_text = input_text
        self.ai_response = ai_response
        self.raw = raw


def fetch_all_bot_updates(*, max_batches: int = 500) -> List[Dict[str, Any]]:
    """Drain Telegram getUpdates queue (marks updates as read on Telegram side)."""
    all_updates: List[Dict[str, Any]] = []
    offset: Optional[int] = None

    for _ in range(max_batches):
        payload: Dict[str, Any] = {"limit": 100, "timeout": 0}
        if offset is not None:
            payload["offset"] = offset
        data = _post_telegram("getUpdates", payload) or {}
        batch = list(data.get("result") or [])
        if not batch:
            break
        all_updates.extend(batch)
        offset = max(int(u.get("update_id", 0)) for u in batch) + 1

    return all_updates


def _unix_to_dt(ts: Any) -> Optional[datetime]:
    try:
        return datetime.fromtimestamp(int(ts), tz=timezone.utc)
    except (TypeError, ValueError, OSError):
        return None


def _flatten_telegram_text(value: Any) -> str:
    if isinstance(value, str):
        return value
    if isinstance(value, list):
        parts: List[str] = []
        for item in value:
            if isinstance(item, str):
                parts.append(item)
            elif isinstance(item, dict) and item.get("text"):
                parts.append(str(item["text"]))
        return "".join(parts)
    return str(value or "")


def _resolve_customer_id(
    customer_id: Optional[str],
    customer_name: Optional[str],
) -> Tuple[Optional[str], Optional[str]]:
    if customer_id:
        return customer_id, customer_name

    if not customer_name:
        return None, None

    matches = search_customers_by_name(customer_name, limit=5)
    if len(matches) == 1:
        return str(matches[0].customer_id), matches[0].customer_name
    if len(matches) > 1:
        # Prefer exact case-insensitive name match
        lower = customer_name.lower().strip()
        for m in matches:
            if m.customer_name.lower().strip() == lower:
                return str(m.customer_id), m.customer_name
    return None, customer_name


def parse_telegram_text_message(
    text: str,
    *,
    message_date: Optional[datetime] = None,
    chat_id: Optional[str] = None,
    message_id: Optional[int] = None,
    raw: Optional[Dict[str, Any]] = None,
) -> Optional[ParsedTelegramMessage]:
    """Parse CRM-related Telegram text into interaction fields."""
    body = (text or "").strip()
    if len(body) < 8:
        return None

    customer_id: Optional[str] = None
    customer_name: Optional[str] = None
    input_text = body
    ai_response = ""

    # Telegram CRM bot notifications (emoji headers + Customer ID line)
    if "new customer interaction" in body.lower() or re.search(
        r"customer\s*id\s*:", body, re.I
    ):
        cid_m = re.search(
            r"Customer\s*ID\s*:\s*([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})",
            body,
            re.I,
        )
        if cid_m:
            customer_id = cid_m.group(1)
        cust_m = re.search(
            r"Customer\s*:\s*(.+?)(?:\n|Customer\s*ID\s*:)",
            body,
            re.I | re.S,
        )
        if cust_m:
            customer_name = cust_m.group(1).strip()
        user_m = re.search(
            r"User\s*Input\s*:\s*(.+?)(?:\n(?:AI\s*Response|📎|File\s*Attached)|\Z)",
            body,
            re.I | re.S,
        )
        ai_m = re.search(
            r"AI\s*Response\s*:\s*(.+?)(?:\n(?:📎|File\s*Attached|http)|\Z)",
            body,
            re.I | re.S,
        )
        if user_m:
            input_text = user_m.group(1).strip()[:12000]
        if ai_m:
            ai_response = ai_m.group(1).strip()[:12000]
    # LeanChem outbound notification format (this app + similar automations)
    elif "leanchem" in body.lower() and "customer:" in body.lower():
        cm = re.search(
            r"Customer:\s*(.+?)\s*\(([0-9a-f-]{36})\)",
            body,
            re.IGNORECASE | re.DOTALL,
        )
        if cm:
            customer_name = cm.group(1).strip()
            customer_id = cm.group(2).strip()
        note_m = re.search(r"Note:\s*(.+?)(?:\n\nAI:|\Z)", body, re.IGNORECASE | re.DOTALL)
        ai_m = re.search(r"AI:\s*(.+?)\Z", body, re.IGNORECASE | re.DOTALL)
        input_text = (note_m.group(1).strip() if note_m else body)[:12000]
        ai_response = (ai_m.group(1).strip() if ai_m else "")[:12000]
    else:
        # Heuristic: UUID anywhere in message
        um = UUID_RE.search(body)
        if um:
            customer_id = um.group(0)
        # Customer: Name line
        nm = re.search(r"(?:Customer|Client|Account)[:\s]+(.+?)(?:\n|$)", body, re.I)
        if nm:
            customer_name = nm.group(1).strip()[:200]
        # Q/A blocks
        qm = re.search(r"(?:^|\n)(?:Q|Question|Note|User)[:\s]+(.+?)(?:\n(?:A|Answer|AI)[:\s]|$)", body, re.I | re.S)
        am = re.search(r"(?:^|\n)(?:A|Answer|AI|Response)[:\s]+(.+?)$", body, re.I | re.S)
        if qm:
            input_text = qm.group(1).strip()[:12000]
        if am:
            ai_response = am.group(1).strip()[:12000]

    customer_id, customer_name = _resolve_customer_id(customer_id, customer_name)
    if not customer_id:
        return None

    return ParsedTelegramMessage(
        text=body,
        message_date=message_date,
        chat_id=chat_id,
        message_id=message_id,
        customer_id=customer_id,
        customer_name=customer_name,
        input_text=input_text or body[:12000],
        ai_response=ai_response,
        raw=raw or {},
    )


def _message_from_update(update: Dict[str, Any]) -> Optional[ParsedTelegramMessage]:
    msg = (
        update.get("message")
        or update.get("channel_post")
        or update.get("edited_message")
        or update.get("edited_channel_post")
    )
    if not msg or not isinstance(msg, dict):
        return None
    text = _flatten_telegram_text(msg.get("text") or msg.get("caption"))
    if not text.strip():
        return None
    chat = msg.get("chat") or {}
    return parse_telegram_text_message(
        text,
        message_date=_unix_to_dt(msg.get("date")),
        chat_id=str(chat.get("id")) if chat.get("id") is not None else None,
        message_id=msg.get("message_id"),
        raw=update,
    )


def load_telegram_desktop_export(path: str) -> List[ParsedTelegramMessage]:
    """
    Parse Telegram Desktop JSON export (result.json or similar).
    """
    file_path = Path(path)
    if not file_path.exists():
        raise FileNotFoundError(path)

    data = json.loads(file_path.read_text(encoding="utf-8"))
    messages = data.get("messages") if isinstance(data, dict) else None
    if not isinstance(messages, list):
        raise ValueError("Expected JSON object with a 'messages' array (Telegram Desktop export).")

    parsed: List[ParsedTelegramMessage] = []
    for msg in messages:
        if not isinstance(msg, dict):
            continue
        if msg.get("type") not in (None, "message"):
            continue
        text = _flatten_telegram_text(msg.get("text"))
        if not text.strip():
            continue
        date_str = msg.get("date")
        message_date: Optional[datetime] = None
        if date_str:
            try:
                message_date = datetime.fromisoformat(str(date_str).replace("Z", "+00:00"))
                if message_date.tzinfo is None:
                    message_date = message_date.replace(tzinfo=timezone.utc)
            except ValueError:
                message_date = None
        row = parse_telegram_text_message(
            text,
            message_date=message_date,
            chat_id=str(msg.get("chat_id")) if msg.get("chat_id") is not None else None,
            message_id=msg.get("id"),
            raw=msg,
        )
        if row:
            parsed.append(row)
    return parsed


def _existing_fingerprints_for_customer(customer_id: str) -> set[str]:
    supabase = get_supabase_service_client()
    fps: set[str] = set()
    offset = 0
    while True:
        resp = (
            supabase.table("interactions")
            .select("input_text, ai_response")
            .eq("customer_id", customer_id)
            .range(offset, offset + 499)
            .execute()
        )
        rows = resp.data or []
        if not rows:
            break
        for r in rows:
            fps.add(_interaction_fingerprint(r.get("input_text") or "", r.get("ai_response") or ""))
        if len(rows) < 500:
            break
        offset += 500
    return fps


def backfill_parsed_messages(
    messages: List[ParsedTelegramMessage],
    *,
    dry_run: bool = True,
    source_tag: str = "telegram_backfill",
) -> Dict[str, Any]:
    """
    Insert parsed Telegram messages into public.interactions (skip duplicates).
    """
    inserted = 0
    skipped_duplicate = 0
    skipped_unparsed = 0
    errors: List[str] = []
    preview: List[Dict[str, Any]] = []

    customer_fps: Dict[str, set[str]] = {}

    for pm in messages:
        if not pm.customer_id:
            skipped_unparsed += 1
            continue

        cid = pm.customer_id
        if cid not in customer_fps:
            customer_fps[cid] = _existing_fingerprints_for_customer(cid)

        fp = _interaction_fingerprint(pm.input_text, pm.ai_response)
        if fp in customer_fps[cid]:
            skipped_duplicate += 1
            continue

        preview.append(
            {
                "customer_id": cid,
                "customer_name": pm.customer_name,
                "created_at": pm.message_date.isoformat() if pm.message_date else None,
                "input_preview": (pm.input_text or "")[:120],
                "ai_preview": (pm.ai_response or "")[:120],
            }
        )

        if dry_run:
            customer_fps[cid].add(fp)
            inserted += 1
            continue

        try:
            note = pm.input_text or ""
            if source_tag:
                note = f"[{source_tag}]\n{note}".strip()
            payload: Dict[str, Any] = {
                "customer_id": cid,
                "input_text": note,
                "ai_response": pm.ai_response or None,
            }
            if pm.message_date:
                payload["created_at"] = pm.message_date.isoformat()
            supabase = get_supabase_service_client()
            supabase.table("interactions").insert(payload).execute()
            customer_fps[cid].add(fp)
            inserted += 1
        except Exception as exc:
            errors.append(f"{cid}: {exc}")

    return {
        "dry_run": dry_run,
        "parsed": len(messages),
        "would_insert_or_inserted": inserted,
        "skipped_duplicate": skipped_duplicate,
        "skipped_unparsed": skipped_unparsed,
        "errors": errors[:20],
        "preview": preview[:30],
    }


def backfill_from_bot_updates(*, dry_run: bool = True) -> Dict[str, Any]:
    updates = fetch_all_bot_updates()
    parsed = [p for u in updates if (p := _message_from_update(u))]
    return {
        "source": "telegram_getUpdates",
        "updates_fetched": len(updates),
        **backfill_parsed_messages(parsed, dry_run=dry_run),
    }


def backfill_from_export_file(path: str, *, dry_run: bool = True) -> Dict[str, Any]:
    parsed = load_telegram_desktop_export(path)
    return {
        "source": "telegram_desktop_export",
        "export_path": path,
        **backfill_parsed_messages(parsed, dry_run=dry_run),
    }


def backfill_requirements() -> Dict[str, Any]:
    return {
        "required_for_bot_queue": [
            "TELEGRAM_BOT_TOKEN — from @BotFather",
            "TELEGRAM_CHAT_ID — numeric chat id of the CRM group/channel (use @userinfobot or getUpdates once)",
        ],
        "required_for_full_history": [
            "Telegram Desktop → Settings → Advanced → Export → JSON (result.json)",
            "Path to that file on the machine running the backfill script",
        ],
        "strongly_recommended": [
            "2–3 sample messages pasted or screenshot (shows how customer name / note / AI text appear)",
            "Whether messages are outbound CRM notifications or inbound sales notes typed in the group",
            "Target customer(s) e.g. Mc-Bauchemie — or confirm all customers in that chat",
            "Date range to import (e.g. May 2025–May 2026)",
        ],
        "limitations": [
            "getUpdates is empty if another service already polls the bot or messages are older than ~24h unacked queue",
            "Bot API cannot scrape full group history; use Desktop export for that",
            "Messages without customer UUID or resolvable customer name are skipped",
        ],
    }
