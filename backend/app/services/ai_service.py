"""
AI Service — Gemini primary, OpenAI failover, RAG helpers
=========================================================

All generative chat flows through AIService.generate_text:

  1. emergency_ai_killswitch (app_settings)
  2. Google Gemini (GEMINI_CHAT_MODEL, default gemini-2.5-flash)
  3. On timeout / 504 / 429 / API error → OpenAI (MODEL_CHOICE / gpt-4o, then gpt-4o-mini)

Embeddings remain OpenAI-only (ai_embed / gemini_embed).

Public API (backward-compatible):
- gemini_chat(messages, *, model=None, max_tokens=None, task_type="general") -> str
- gemini_embed(text) -> List[float]
- log_conversation_to_rag(...)
- search_documents(...)
"""

from __future__ import annotations

import asyncio
import logging
import os
import time
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from enum import Enum
from typing import Any, Dict, List, Optional, Tuple, Union
from urllib.parse import urlparse

from openai import AsyncOpenAI, OpenAI
from supabase import Client

from app.config import settings
from app.core import ai_config
from app.database.connection import get_supabase_service_client
from app.models.crm import Customer, Interaction

logger = logging.getLogger(__name__)

CHAT_MODEL = (
    settings.MODEL_CHOICE or settings.OPENAI_CHAT_MODEL or "gpt-4o-mini"
)
EMBED_MODEL = settings.OPENAI_EMBED_MODEL or "text-embedding-3-small"
EMBED_DIM = settings.OPENAI_EMBED_DIM or 768

PRIMARY_OPENAI_MODEL = "gpt-4o"
FALLBACK_OPENAI_MODEL = "gpt-4o-mini"
DEFAULT_GEMINI_MODEL = "gemini-2.5-flash"

FAILOVER_TELEGRAM_MESSAGE = (
    "⚠️ AI Failover triggered. Gemini timed out. Falling back to OpenAI."
)

ICP_TASK_TYPES = frozenset({"icp", "profile", "crm_profile"})
SUMMARY_TASK_TYPES = frozenset(
    {"summary", "summaries", "pipeline_insights", "sales_advice"}
)


class TaskComplexity(Enum):
    HIGH_VOLUME_FAST = "high_volume_fast"
    DEEP_REASONING_RAG = "deep_reasoning_rag"


class AIServiceError(Exception):
    """Raised when an AI provider call fails or a guardrail blocks generation."""


GeminiError = AIServiceError


_openai_client: Optional[OpenAI] = None
_gemini_configured = False
_ai_service: Optional["AIService"] = None
_sync_loop_pool = ThreadPoolExecutor(max_workers=4, thread_name_prefix="ai-sync")


def _openai_api_key() -> str:
    return ai_config.openai_api_key()


def _gemini_api_key() -> str:
    return ai_config.gemini_api_key()


def _gemini_model_name() -> str:
    return ai_config.gemini_chat_model() or DEFAULT_GEMINI_MODEL


def _get_openai_client() -> OpenAI:
    global _openai_client
    key = _openai_api_key()
    if _openai_client is None:
        if not key:
            raise AIServiceError(
                "OPENAI_API_KEY is not configured in environment/settings."
            )
        if len(key) < 20:
            raise AIServiceError(
                "OPENAI_API_KEY looks truncated. Re-copy the full key on Vercel."
            )
        _openai_client = OpenAI(api_key=key)
    return _openai_client


def reset_openai_client() -> None:
    """Clear cached OpenAI client (e.g. after env key rotation)."""
    global _openai_client
    _openai_client = None


_api_key = _openai_api_key
_get_client = _get_openai_client


def reset_gemini_client() -> None:
    """Clear Gemini configure flag so the next call re-reads GEMINI_API_KEY."""
    global _gemini_configured, _ai_service
    _gemini_configured = False
    if _ai_service is not None:
        _ai_service._reset_gemini()


def _extract_openai_text(resp: Any) -> str:
    choice = resp.choices[0] if resp.choices else None
    if not choice or not choice.message or not choice.message.content:
        return ""
    return choice.message.content


def _openai_messages_to_gemini(
    messages: List[Dict[str, str]],
) -> Tuple[Optional[str], List[Dict[str, Any]]]:
    system_parts: List[str] = []
    contents: List[Dict[str, Any]] = []

    for msg in messages:
        role = (msg.get("role") or "user").lower()
        content = (msg.get("content") or "").strip()
        if not content:
            continue
        if role == "system":
            system_parts.append(content)
        elif role == "assistant":
            contents.append({"role": "model", "parts": [content]})
        else:
            contents.append({"role": "user", "parts": [content]})

    system_instruction = "\n\n".join(system_parts) if system_parts else None
    return system_instruction, contents


def _messages_to_prompt(
    messages: List[Dict[str, str]],
) -> Tuple[str, str]:
    system_instruction, contents = _openai_messages_to_gemini(messages)
    prompt_chunks: List[str] = []
    for item in contents:
        parts = item.get("parts") or []
        text = "\n".join(str(p) for p in parts if p)
        role = item.get("role") or "user"
        prompt_chunks.append(f"{role}: {text}" if len(contents) > 1 else text)
    prompt = "\n\n".join(prompt_chunks).strip()
    return prompt, system_instruction or ""


def _configure_gemini_legacy() -> None:
    global _gemini_configured
    key = _gemini_api_key()
    if not key:
        raise AIServiceError(
            "GEMINI_API_KEY is not configured. Set it in environment/settings."
        )
    try:
        import google.generativeai as genai
    except ImportError as exc:
        raise AIServiceError(
            "google-generativeai is not installed. Add it to requirements.txt."
        ) from exc

    if not _gemini_configured:
        genai.configure(api_key=key)
        _gemini_configured = True


def _extract_gemini_text(response: Any) -> str:
    text = getattr(response, "text", None)
    if text and str(text).strip():
        return str(text).strip()
    candidates = getattr(response, "candidates", None) or []
    for candidate in candidates:
        content = getattr(candidate, "content", None)
        parts = getattr(content, "parts", None) if content else None
        if not parts:
            continue
        chunks = []
        for part in parts:
            part_text = getattr(part, "text", None)
            if part_text:
                chunks.append(str(part_text))
        if chunks:
            return "\n".join(chunks).strip()
    return ""


def _usage_from_gemini(response: Any) -> Tuple[int, int]:
    usage = getattr(response, "usage_metadata", None)
    if not usage:
        return 0, 0
    inp = (
        getattr(usage, "prompt_token_count", None)
        or getattr(usage, "prompt_tokens", None)
        or 0
    )
    out = (
        getattr(usage, "candidates_token_count", None)
        or getattr(usage, "candidates_tokens", None)
        or getattr(usage, "output_token_count", None)
        or 0
    )
    return int(inp or 0), int(out or 0)


def _usage_from_openai(resp: Any) -> Tuple[int, int]:
    usage = getattr(resp, "usage", None)
    if not usage:
        return 0, 0
    return int(getattr(usage, "prompt_tokens", 0) or 0), int(
        getattr(usage, "completion_tokens", 0) or 0
    )


def _estimate_tokens(text: str) -> int:
    return max(1, len(text or "") // 4)


def _complexity_for_task(task_type: str) -> TaskComplexity:
    if (task_type or "").strip().lower() in ICP_TASK_TYPES:
        return TaskComplexity.DEEP_REASONING_RAG
    return TaskComplexity.HIGH_VOLUME_FAST


def _default_timeout_for_task(task_type: str) -> float:
    kind = (task_type or "general").strip().lower()
    if kind in ICP_TASK_TYPES:
        return 45.0
    if kind in SUMMARY_TASK_TYPES or kind in ("extraction", "tds_extract"):
        return 25.0
    return 12.0


def _run_coro_sync(coro):
    """Run an async coroutine from sync FastAPI/service callers."""
    try:
        asyncio.get_running_loop()
    except RuntimeError:
        return asyncio.run(coro)
    future = _sync_loop_pool.submit(asyncio.run, coro)
    return future.result()


class AIService:
    def __init__(self, supabase_client: Optional[Client] = None):
        self.supabase = supabase_client
        self.default_gemini_model = _gemini_model_name()
        self.default_openai_model = ai_config.openai_chat_model() or PRIMARY_OPENAI_MODEL
        gemini_key = _gemini_api_key()
        openai_key = _openai_api_key()
        self._google_genai_client = None
        if gemini_key:
            try:
                from google import genai as google_genai

                self._google_genai_client = google_genai.Client(api_key=gemini_key)
            except Exception as exc:
                logger.info("google.genai Client unavailable (%s); using generativeai", exc)
        self.gemini_client = self._google_genai_client
        self.openai_client = AsyncOpenAI(api_key=openai_key) if openai_key else None

    def _reset_gemini(self) -> None:
        key = _gemini_api_key()
        self.default_gemini_model = _gemini_model_name()
        self._google_genai_client = None
        if key:
            try:
                from google import genai as google_genai

                self._google_genai_client = google_genai.Client(api_key=key)
            except Exception:
                self._google_genai_client = None
        self.gemini_client = self._google_genai_client

    def _supabase(self) -> Optional[Client]:
        if self.supabase is not None:
            return self.supabase
        try:
            self.supabase = get_supabase_service_client()
        except Exception as exc:
            logger.debug("AI settings client unavailable: %s", exc)
            self.supabase = None
        return self.supabase

    def _table_query(self, table: str):
        client = self._supabase()
        if client is None:
            raise RuntimeError("no supabase")
        return client.table(table)

    async def _fetch_settings_map(self) -> Optional[Dict[str, Any]]:
        try:
            resp = await asyncio.to_thread(
                lambda: self._table_query("app_settings").select("key, value").execute()
            )
        except Exception as exc:
            logger.debug("app_settings not available: %s", exc)
            return None
        rows = getattr(resp, "data", None) or []
        return {str(row.get("key")): row.get("value") for row in rows if row.get("key")}

    async def read_guardrails(self) -> Dict[str, Any]:
        data = await self._fetch_settings_map()
        tables_available = data is not None
        data = data or {}
        return {
            "emergency_ai_killswitch": ai_config.setting_as_bool(
                data.get("emergency_ai_killswitch"), False
            ),
            "enable_ai_summaries": ai_config.setting_as_bool(
                data.get("enable_ai_summaries"), True
            ),
            "enable_ai_icp": ai_config.setting_as_bool(data.get("enable_ai_icp"), True),
            "monthly_budget_cap_usd": ai_config.setting_as_float(
                data.get("monthly_budget_cap_usd"), 50.0
            ),
            "current_month_spend_usd": ai_config.setting_as_float(
                data.get("current_month_spend_usd"), 0.0
            ),
            "budget_alert_level": int(
                ai_config.setting_as_float(data.get("budget_alert_level"), 0)
            ),
            "tables_available": tables_available,
        }

    def _assert_feature_enabled(self, flags: Dict[str, Any], task_type: str) -> None:
        kind = (task_type or "general").strip().lower()
        if kind in ICP_TASK_TYPES and not flags.get("enable_ai_icp", True):
            raise AIServiceError("AI ICP generation is disabled (enable_ai_icp).")
        if kind in SUMMARY_TASK_TYPES and not flags.get("enable_ai_summaries", True):
            raise AIServiceError("AI summaries are disabled (enable_ai_summaries).")

    async def _log_usage(
        self,
        *,
        provider: str,
        model: str,
        task_type: str,
        input_tokens: int,
        output_tokens: int,
        estimated_cost_usd: float,
        status: str,
        latency_ms: int,
    ) -> None:
        payload = {
            "provider": provider,
            "model": model,
            "task_type": task_type,
            "input_tokens": input_tokens,
            "output_tokens": output_tokens,
            "estimated_cost_usd": estimated_cost_usd,
            "status": status,
            "latency_ms": latency_ms,
        }
        try:
            await asyncio.to_thread(
                lambda: self._table_query("ai_usage_logs").insert(payload).execute()
            )
        except Exception as exc:
            logger.debug("ai_usage_logs insert skipped: %s", exc)

    async def _bump_spend_and_alert(self, cost: float, flags: Dict[str, Any]) -> None:
        if cost <= 0 or not flags.get("tables_available"):
            return
        new_spend = float(flags.get("current_month_spend_usd") or 0) + cost
        cap = float(flags.get("monthly_budget_cap_usd") or 50.0)
        last_level = int(flags.get("budget_alert_level") or 0)
        now = datetime.now(timezone.utc).isoformat()
        try:
            await asyncio.to_thread(
                lambda: self._table_query("app_settings")
                .update({"value": new_spend, "updated_at": now})
                .eq("key", "current_month_spend_usd")
                .execute()
            )
        except Exception as exc:
            logger.debug("current_month_spend_usd update skipped: %s", exc)
            return

        new_level = await ai_config.check_budget_and_alert(new_spend, cap, last_level)
        if new_level != last_level:
            try:
                await asyncio.to_thread(
                    lambda: self._table_query("app_settings")
                    .upsert(
                        {
                            "key": "budget_alert_level",
                            "value": new_level,
                            "updated_at": now,
                        },
                        on_conflict="key",
                    )
                    .execute()
                )
            except Exception as exc:
                logger.debug("budget_alert_level update skipped: %s", exc)

    def _gemini_generate_sync(
        self,
        prompt: str,
        system_instruction: str,
        max_tokens: Optional[int],
    ) -> Tuple[str, int, int]:
        if self._google_genai_client is not None:
            try:
                from google.genai import types

                config_kwargs: Dict[str, Any] = {"temperature": 0.7}
                if max_tokens is not None:
                    config_kwargs["max_output_tokens"] = max_tokens
                if system_instruction:
                    config_kwargs["system_instruction"] = system_instruction
                response = self._google_genai_client.models.generate_content(
                    model=self.default_gemini_model,
                    contents=prompt,
                    config=types.GenerateContentConfig(**config_kwargs),
                )
                text = _extract_gemini_text(response)
                inp, out = _usage_from_gemini(response)
                return text, inp, out
            except Exception as exc:
                logger.info("google.genai generate_content failed; trying generativeai: %s", exc)

        import google.generativeai as genai

        _configure_gemini_legacy()
        model_kwargs: Dict[str, Any] = {}
        if system_instruction:
            model_kwargs["system_instruction"] = system_instruction
        model = genai.GenerativeModel(self.default_gemini_model, **model_kwargs)
        generation_config: Dict[str, Any] = {"temperature": 0.7}
        if max_tokens is not None:
            generation_config["max_output_tokens"] = max_tokens
        response = model.generate_content(prompt, generation_config=generation_config)
        text = _extract_gemini_text(response)
        inp, out = _usage_from_gemini(response)
        return text, inp, out

    async def _openai_generate(
        self,
        prompt: str,
        system_instruction: str,
        model: str,
        max_tokens: Optional[int],
    ) -> Tuple[str, int, int]:
        if self.openai_client is None:
            raise AIServiceError("OPENAI_API_KEY is not configured.")
        messages: List[Dict[str, str]] = []
        if system_instruction:
            messages.append({"role": "system", "content": system_instruction})
        messages.append({"role": "user", "content": prompt})
        kwargs: Dict[str, Any] = {
            "model": model,
            "messages": messages,
            "temperature": 0.7,
        }
        if max_tokens is not None:
            kwargs["max_tokens"] = max_tokens
        resp = await self.openai_client.chat.completions.create(**kwargs)
        return _extract_openai_text(resp), *_usage_from_openai(resp)

    async def generate_text(
        self,
        prompt: str,
        system_instruction: str = "",
        task_type: str = "general",
        timeout_seconds: float = 4.0,
        max_tokens: Optional[int] = None,
    ) -> dict:
        """
        Gemini-first generation with killswitch, timeout, OpenAI failover, and telemetry.
        """
        started = time.perf_counter()
        flags = await self.read_guardrails()

        if flags.get("emergency_ai_killswitch"):
            latency = int((time.perf_counter() - started) * 1000)
            await self._log_usage(
                provider="gemini",
                model=self.default_gemini_model,
                task_type=task_type,
                input_tokens=0,
                output_tokens=0,
                estimated_cost_usd=0.0,
                status="killswitch_active",
                latency_ms=latency,
            )
            raise AIServiceError("Emergency AI killswitch is active.")

        self._assert_feature_enabled(flags, task_type)

        complexity = _complexity_for_task(task_type)
        openai_model = (
            self.default_openai_model
            if complexity == TaskComplexity.DEEP_REASONING_RAG
            else FALLBACK_OPENAI_MODEL
        )
        if complexity == TaskComplexity.DEEP_REASONING_RAG and not openai_model:
            openai_model = PRIMARY_OPENAI_MODEL

        gemini_error: Optional[BaseException] = None
        try:
            content, inp, out = await asyncio.wait_for(
                asyncio.to_thread(
                    self._gemini_generate_sync,
                    prompt,
                    system_instruction,
                    max_tokens,
                ),
                timeout=timeout_seconds,
            )
            if not (content or "").strip():
                raise AIServiceError("Gemini returned empty content.")
            inp = inp or _estimate_tokens(system_instruction + prompt)
            out = out or _estimate_tokens(content)
            cost = ai_config.estimate_cost_usd(self.default_gemini_model, inp, out)
            latency = int((time.perf_counter() - started) * 1000)
            await self._log_usage(
                provider="gemini",
                model=self.default_gemini_model,
                task_type=task_type,
                input_tokens=inp,
                output_tokens=out,
                estimated_cost_usd=cost,
                status="success",
                latency_ms=latency,
            )
            await self._bump_spend_and_alert(cost, flags)
            return {
                "content": content,
                "provider_used": "gemini",
                "is_fallback": False,
            }
        except Exception as exc:
            gemini_error = exc
            logger.warning("Gemini generation failed (%s); failing over to OpenAI", exc)

        await ai_config.send_telegram_alert(FAILOVER_TELEGRAM_MESSAGE)

        last_openai_error: Optional[BaseException] = None
        models_to_try = [openai_model]
        if openai_model != FALLBACK_OPENAI_MODEL:
            models_to_try.append(FALLBACK_OPENAI_MODEL)

        for model in models_to_try:
            try:
                content, inp, out = await self._openai_generate(
                    prompt, system_instruction, model, max_tokens
                )
                if not (content or "").strip():
                    raise AIServiceError("OpenAI returned empty content.")
                inp = inp or _estimate_tokens(system_instruction + prompt)
                out = out or _estimate_tokens(content)
                cost = ai_config.estimate_cost_usd(model, inp, out)
                latency = int((time.perf_counter() - started) * 1000)
                await self._log_usage(
                    provider="openai",
                    model=model,
                    task_type=task_type,
                    input_tokens=inp,
                    output_tokens=out,
                    estimated_cost_usd=cost,
                    status="fallback_triggered",
                    latency_ms=latency,
                )
                await self._bump_spend_and_alert(cost, flags)
                return {
                    "content": content,
                    "provider_used": "openai",
                    "is_fallback": True,
                }
            except Exception as openai_exc:
                last_openai_error = openai_exc
                logger.warning("OpenAI fallback model %s failed: %s", model, openai_exc)

        latency = int((time.perf_counter() - started) * 1000)
        await self._log_usage(
            provider="openai",
            model=openai_model,
            task_type=task_type,
            input_tokens=0,
            output_tokens=0,
            estimated_cost_usd=0.0,
            status="error",
            latency_ms=latency,
        )
        raise AIServiceError(
            "All chat providers failed. Gemini: "
            f"{gemini_error}; OpenAI: {last_openai_error}"
        ) from last_openai_error


def get_ai_service() -> AIService:
    global _ai_service
    if _ai_service is None:
        try:
            client = get_supabase_service_client()
        except Exception:
            client = None
        _ai_service = AIService(client)
    return _ai_service


def ai_chat(
    messages: List[Dict[str, str]],
    *,
    model: Optional[str] = None,
    max_tokens: Optional[int] = None,
    task_type: str = "general",
    timeout_seconds: Optional[float] = None,
) -> str:
    """
    Chat completion via the central orchestrator (signature extended, still sync).

    Cascade: Gemini → OpenAI failover.
    """
    if model is not None and model.strip():
        logger.debug("ai_chat: explicit model=%s ignored; orchestrator selects providers", model)

    prompt, system_instruction = _messages_to_prompt(messages)
    if not prompt:
        raise AIServiceError("No user/model content to send to the AI orchestrator.")

    timeout = (
        timeout_seconds
        if timeout_seconds is not None
        else _default_timeout_for_task(task_type)
    )
    result = _run_coro_sync(
        get_ai_service().generate_text(
            prompt=prompt,
            system_instruction=system_instruction,
            task_type=task_type,
            timeout_seconds=timeout,
            max_tokens=max_tokens,
        )
    )
    return (result.get("content") or "").strip()


def ai_embed(text: str) -> List[float]:
    """
    Get an embedding vector for a single piece of text.

    Returns a 768-dim vector to match the existing pgvector(768) columns
    in `conversation.embedding` and `documents.embedding`.
    """
    if not text or not text.strip():
        raise AIServiceError("Cannot embed empty text")

    try:
        resp = _get_openai_client().embeddings.create(
            model=EMBED_MODEL,
            input=text,
            dimensions=EMBED_DIM,
        )
    except Exception as e:
        status = getattr(e, "status_code", None) or getattr(e, "code", "")
        message = getattr(e, "message", None) or str(e)
        raise AIServiceError(f"OpenAI embed error {status}: {message}".strip())

    if not resp.data:
        raise AIServiceError("OpenAI embed returned no data")
    return [float(x) for x in resp.data[0].embedding]


gemini_chat = ai_chat
gemini_embed = ai_embed


def log_conversation_to_rag(
    content: str,
    embedding: Optional[List[float]] = None,
    metadata: Optional[Dict[str, Any]] = None,
) -> None:
    """
    Store a conversation snippet in the `conversation` table for RAG.

    Args:
        content: The human-readable text (e.g. "Q: ...\\nA: ...").
        embedding: Precomputed embedding (768-dim) or None.
        metadata: Optional JSON-serializable dict with extra info
                  (customer_id, user_id, tds_id, source, etc.).
    """
    supabase: Client = get_supabase_service_client()

    row: Dict[str, Any] = {
        "content": content,
        "metadata": metadata or {},
    }
    if embedding is not None:
        row["embedding"] = embedding

    supabase.table("conversation").insert(row).execute()


# CRM profile Deep Dive: strict company lock-in (no global fallback pool).
PROFILE_RAG_MATCH_THRESHOLD = 0.75
PROFILE_RAG_VECTOR_FETCH_MULTIPLIER = 4


def _normalize_company_name(name: str) -> str:
    return " ".join((name or "").lower().split())


def _domain_from_website(url: Optional[str]) -> Optional[str]:
    if not url or not str(url).strip():
        return None
    try:
        host = urlparse(str(url).strip()).netloc.lower()
        if host.startswith("www."):
            host = host[4:]
        return host or None
    except Exception:
        return None


def _metadata_belongs_to_customer(
    metadata: Any,
    *,
    customer_id: str,
    customer_name: str,
    domain: Optional[str],
) -> bool:
    """Hard filter: document must be explicitly linked to this company."""
    if not isinstance(metadata, dict):
        return False

    meta_cid = str(metadata.get("customer_id") or "").strip()
    if meta_cid and meta_cid == str(customer_id):
        return True

    meta_name = (metadata.get("customer_name") or "").strip()
    if meta_name and _normalize_company_name(meta_name) == _normalize_company_name(
        customer_name
    ):
        return True

    if domain:
        for key in ("domain", "website", "website_url", "company_domain"):
            val = metadata.get(key)
            if val and domain in str(val).lower():
                return True

    return False


def _build_profile_rag_search_query(
    customer: Customer,
    interactions: List[Union[Interaction, Dict[str, Any]]],
) -> str:
    """Embedding query: company name + themes from recent CRM interactions."""
    name = (customer.customer_name or "").strip()
    theme_parts: List[str] = []

    for item in interactions[:6]:
        if isinstance(item, Interaction):
            input_text = item.input_text
            ai_response = item.ai_response
        elif isinstance(item, dict):
            input_text = item.get("input_text")
            ai_response = item.get("ai_response")
        else:
            continue
        chunk = " ".join(
            filter(
                None,
                [
                    (str(input_text or ""))[:280].strip(),
                    (str(ai_response or ""))[:280].strip(),
                ],
            )
        ).strip()
        if chunk:
            theme_parts.append(chunk)

    domain = _domain_from_website(customer.website_url)
    query_bits = [f"Company: {name}"]
    if domain:
        query_bits.append(f"Domain: {domain}")
    if theme_parts:
        query_bits.append(
            "Recent operational context: " + " | ".join(theme_parts[:4])
        )
    else:
        query_bits.append(
            "B2B chemical supply, construction materials, customer relationship"
        )
    return "\n".join(query_bits)[:4000]


def _fetch_metadata_linked_rag_rows(
    *,
    customer_id: str,
    customer_name: str,
    domain: Optional[str],
    limit: int,
) -> List[Dict[str, Any]]:
    """Rows from conversation/documents with metadata tied to this customer only."""
    supabase: Client = get_supabase_service_client()
    cid = str(customer_id)
    collected: List[Dict[str, Any]] = []
    seen: set[str] = set()

    def add_row(row: Dict[str, Any], source_table: str) -> None:
        row_id = str(row.get("id") or "")
        content = (row.get("content") or "").strip()
        if not content:
            return
        meta = row.get("metadata") or {}
        if not _metadata_belongs_to_customer(
            meta,
            customer_id=cid,
            customer_name=customer_name,
            domain=domain,
        ):
            return
        dedupe = row_id or content[:200]
        if dedupe in seen:
            return
        seen.add(dedupe)
        collected.append(
            {
                "id": row_id or None,
                "content": content,
                "metadata": meta,
                "similarity": 1.0,
                "source_table": source_table,
            }
        )

    for table in ("conversation", "documents"):
        try:
            by_id = (
                supabase.table(table)
                .select("id, content, metadata, created_at")
                .eq("metadata->>customer_id", cid)
                .order("created_at", desc=True)
                .limit(limit)
                .execute()
            )
            for row in by_id.data or []:
                add_row(row, table)
        except Exception as exc:
            logger.debug("RAG metadata filter on %s by customer_id: %s", table, exc)

        if len(collected) >= limit:
            break

        if len(_normalize_company_name(customer_name)) < 3:
            continue
        try:
            by_name = (
                supabase.table(table)
                .select("id, content, metadata, created_at")
                .ilike("metadata->>customer_name", customer_name.strip())
                .order("created_at", desc=True)
                .limit(limit)
                .execute()
            )
            for row in by_name.data or []:
                add_row(row, table)
        except Exception as exc:
            logger.debug("RAG metadata filter on %s by customer_name: %s", table, exc)

        if len(collected) >= limit:
            break

    return collected[:limit]


def _vector_search_company_scoped(
    *,
    query_embedding: List[float],
    customer_id: str,
    customer_name: str,
    domain: Optional[str],
    match_count: int,
    match_threshold: float,
) -> List[Dict[str, Any]]:
    """pgvector RPC with metadata filter; post-filter to enforce company lock-in."""
    supabase: Client = get_supabase_service_client()
    cid = str(customer_id)
    rpc_filter: Dict[str, Any] = {
        "customer_id": cid,
        "customer_name": customer_name,
    }
    if domain:
        rpc_filter["domain"] = domain

    hits: List[Dict[str, Any]] = []
    for rpc_name, source_table in (
        ("match_conversation", "conversation"),
        ("match_documents", "documents"),
    ):
        try:
            response = supabase.rpc(
                rpc_name,
                {
                    "query_embedding": query_embedding,
                    "match_count": match_count,
                    "match_threshold": match_threshold,
                    "filter": rpc_filter,
                },
            ).execute()
            for row in response.data or []:
                meta = row.get("metadata") or {}
                if not _metadata_belongs_to_customer(
                    meta,
                    customer_id=cid,
                    customer_name=customer_name,
                    domain=domain,
                ):
                    continue
                sim = row.get("similarity")
                if sim is not None and float(sim) < match_threshold:
                    continue
                hits.append({**row, "source_table": source_table})
        except Exception as exc:
            logger.debug("RAG RPC %s skipped: %s", rpc_name, exc)

    return hits


def search_documents_for_profile(
    *,
    customer: Customer,
    interactions: Optional[List[Union[Interaction, Dict[str, Any]]]] = None,
    user_id: Optional[str] = None,
    limit: int = 16,
    match_threshold: float = PROFILE_RAG_MATCH_THRESHOLD,
) -> List[Dict[str, Any]]:
    """
    Company-scoped RAG for CRM profile Deep Dive.

    - Hard metadata filter (customer_id / customer_name / domain)
    - Contextual embedding query from company + recent interactions
    - Strict similarity threshold (default 0.75)
    - Never falls back to unrelated global rows
    """
    _ = user_id
    customer_id = str(customer.customer_id)
    customer_name = (customer.customer_name or "").strip()
    domain = _domain_from_website(customer.website_url)
    interaction_list = list(interactions or [])

    if not customer_name:
        return []

    linked = _fetch_metadata_linked_rag_rows(
        customer_id=customer_id,
        customer_name=customer_name,
        domain=domain,
        limit=limit,
    )

    vector_hits: List[Dict[str, Any]] = []
    try:
        query = _build_profile_rag_search_query(customer, interaction_list)
        query_embedding = ai_embed(query)
        vector_hits = _vector_search_company_scoped(
            query_embedding=query_embedding,
            customer_id=customer_id,
            customer_name=customer_name,
            domain=domain,
            match_count=max(limit * PROFILE_RAG_VECTOR_FETCH_MULTIPLIER, limit),
            match_threshold=match_threshold,
        )
    except Exception as exc:
        logger.warning(
            "Profile RAG vector search failed for %s: %s", customer_name, exc
        )

    merged: List[Dict[str, Any]] = []
    seen: set[str] = set()

    def append(doc: Dict[str, Any]) -> None:
        content = (doc.get("content") or "").strip()
        if not content:
            return
        meta = doc.get("metadata") or {}
        if not _metadata_belongs_to_customer(
            meta,
            customer_id=customer_id,
            customer_name=customer_name,
            domain=domain,
        ):
            return
        sim = doc.get("similarity")
        if sim is not None and float(sim) < match_threshold:
            return
        key = f"{doc.get('id') or ''}|{content[:240]}"
        if key in seen:
            return
        seen.add(key)
        merged.append(doc)

    for doc in linked:
        append(doc)
    for doc in sorted(
        vector_hits,
        key=lambda d: float(d.get("similarity") or 0),
        reverse=True,
    ):
        append(doc)
        if len(merged) >= limit:
            break

    return merged[:limit]


def search_documents(
    query: str, user_id: Optional[str] = None, limit: int = 3
) -> List[Dict[str, Any]]:
    """
    Search for relevant documents/conversations using RAG (vector similarity).

    1. Generates an embedding for the query
    2. Searches the `conversation` table via the `match_conversation` RPC
    3. Returns the most relevant matches (or [] on failure)
    """
    supabase: Client = get_supabase_service_client()

    try:
        query_embedding = ai_embed(query)
        try:
            response = supabase.rpc(
                "match_conversation",
                {
                    "query_embedding": query_embedding,
                    "match_count": limit,
                    "match_threshold": 0.5,
                    "filter": {},
                },
            ).execute()
            return response.data or []
        except Exception:
            response = (
                supabase.table("conversation")
                .select("content, metadata")
                .limit(limit)
                .execute()
            )
            return response.data or []
    except Exception as e:
        logger.warning("Document search failed: %s", e)
        return []
