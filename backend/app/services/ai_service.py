"""
AI Service - OpenAI + Gemini fallback and RAG helpers
====================================================

Chat completion cascade (ai_chat / gemini_chat):
  1. OpenAI gpt-4o
  2. OpenAI gpt-4o-mini — on OpenAI rate limit / connection errors
  3. Google Gemini (GEMINI_API_KEY) — if both OpenAI tiers fail or rate limit

Embeddings remain OpenAI-only (ai_embed / gemini_embed).

Public API (backward-compatible):
- gemini_chat(messages, *, model=None) -> str
- gemini_embed(text) -> List[float]
- log_conversation_to_rag(...)
- search_documents(...)
"""

from __future__ import annotations

import logging
import os
from typing import Any, Dict, List, Optional, Tuple

from openai import (
    APIConnectionError,
    APIError,
    APITimeoutError,
    OpenAI,
    RateLimitError,
)

from app.config import settings
from app.database.connection import get_supabase_service_client
from supabase import Client

logger = logging.getLogger(__name__)

CHAT_MODEL = (
    settings.MODEL_CHOICE or settings.OPENAI_CHAT_MODEL or "gpt-4o-mini"
)
EMBED_MODEL = settings.OPENAI_EMBED_MODEL or "text-embedding-3-small"
EMBED_DIM = settings.OPENAI_EMBED_DIM or 768

PRIMARY_OPENAI_MODEL = "gpt-4o"
FALLBACK_OPENAI_MODEL = "gpt-4o-mini"
# Tier-2 Gemini model (override via GEMINI_CHAT_MODEL). Google API id is typically
# gemini-2.5-flash; set env if you use a newer alias.
DEFAULT_GEMINI_MODEL = "gemini-2.5-flash"


class AIServiceError(Exception):
    """Raised when an AI provider call fails."""


# Backward-compat alias — existing code imports this name.
GeminiError = AIServiceError


_openai_client: Optional[OpenAI] = None
_gemini_configured = False


def _openai_api_key() -> str:
    return (settings.OPENAI_API_KEY or "").strip()


def _gemini_api_key() -> str:
    return (os.getenv("GEMINI_API_KEY") or settings.GEMINI_API_KEY or "").strip()


def _gemini_model_name() -> str:
    return (
        os.getenv("GEMINI_CHAT_MODEL")
        or settings.GEMINI_CHAT_MODEL
        or DEFAULT_GEMINI_MODEL
    ).strip()


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


# Health-check / legacy imports (auth.py)
_api_key = _openai_api_key
_get_client = _get_openai_client


def reset_gemini_client() -> None:
    """Clear Gemini configure flag so the next call re-reads GEMINI_API_KEY."""
    global _gemini_configured
    _gemini_configured = False


def _provider_fallback_eligible(exc: BaseException) -> bool:
    """True when we should try the next tier (rate limit, timeout, connection)."""
    if isinstance(exc, (RateLimitError, APIConnectionError, APITimeoutError)):
        return True
    status = getattr(exc, "status_code", None)
    if status == 429:
        return True
    if isinstance(exc, APIError):
        code = getattr(exc, "code", None)
        if code == "rate_limit_exceeded":
            return True
    msg = str(exc).lower()
    return (
        "rate limit" in msg
        or "rate_limit" in msg
        or "429" in msg
        or "connection" in msg
        or "timeout" in msg
        or "timed out" in msg
    )


def _format_openai_error(exc: BaseException, model: str) -> str:
    status = getattr(exc, "status_code", None) or getattr(exc, "code", "")
    message = getattr(exc, "message", None) or str(exc)
    hint = ""
    if status == 401 or "invalid_api_key" in str(message).lower():
        hint = (
            " Check OPENAI_API_KEY on your host and create a new key at "
            "https://platform.openai.com/api-keys if needed."
        )
    elif status == 429 or "rate_limit" in str(message).lower():
        hint = " Rate limit hit; cascade retries with gpt-4o-mini then Gemini."
    return f"OpenAI chat error ({model}) {status}: {message}".strip() + hint


def _extract_openai_text(resp: Any) -> str:
    choice = resp.choices[0] if resp.choices else None
    if not choice or not choice.message or not choice.message.content:
        return ""
    return choice.message.content


def _chat_openai(messages: List[Dict[str, str]], model: str) -> str:
    resp = _get_openai_client().chat.completions.create(
        model=model,
        messages=messages,
        temperature=0.7,
    )
    return _extract_openai_text(resp)


def _openai_messages_to_gemini(
    messages: List[Dict[str, str]],
) -> Tuple[Optional[str], List[Dict[str, Any]]]:
    """
    Map OpenAI chat schema to Gemini generate_content contents.

    OpenAI roles: system | user | assistant
    Gemini roles: user | model (+ system_instruction)
    """
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


def _configure_gemini() -> None:
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


def _chat_gemini(messages: List[Dict[str, str]]) -> str:
    """Tier 2: Google Generative AI (Gemini) via GEMINI_API_KEY."""
    import google.generativeai as genai

    _configure_gemini()
    system_instruction, contents = _openai_messages_to_gemini(messages)
    if not contents:
        raise AIServiceError("No user/model content to send to Gemini.")

    model_name = _gemini_model_name()
    model_kwargs: Dict[str, Any] = {}
    if system_instruction:
        model_kwargs["system_instruction"] = system_instruction

    model = genai.GenerativeModel(model_name, **model_kwargs)
    response = model.generate_content(
        contents,
        generation_config={"temperature": 0.7},
    )

    text = getattr(response, "text", None)
    if text and str(text).strip():
        return str(text).strip()

    # Fallback parse for blocked / multi-part responses
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


def ai_chat(
    messages: List[Dict[str, str]],
    *,
    model: Optional[str] = None,
) -> str:
    """
    Chat completion with three-tier fallback (signature unchanged).

    messages: [{"role": "system"|"user"|"assistant", "content": "..."}, ...]
    model: optional — kept for backward compatibility (ignored; cascade is fixed).

    Cascade:
      1. OpenAI gpt-4o
      2. OpenAI gpt-4o-mini
      3. Google Gemini (GEMINI_API_KEY)

    Returns:
      Response text, or "" if the model returned no content.
    """
    if model is not None and model.strip() and model.strip() != PRIMARY_OPENAI_MODEL:
        logger.info(
            "ai_chat: explicit model=%s ignored; using cascade %s → %s → %s",
            model,
            PRIMARY_OPENAI_MODEL,
            FALLBACK_OPENAI_MODEL,
            _gemini_model_name(),
        )

    # --- Tier 1: OpenAI gpt-4o ---
    try:
        logger.debug("ai_chat: attempting OpenAI model=%s", PRIMARY_OPENAI_MODEL)
        return _chat_openai(messages, PRIMARY_OPENAI_MODEL)
    except Exception as primary_exc:
        if not _provider_fallback_eligible(primary_exc):
            raise AIServiceError(
                _format_openai_error(primary_exc, PRIMARY_OPENAI_MODEL)
            ) from primary_exc
        logger.warning(
            "ai_chat: OpenAI %s failed (%s); falling back to OpenAI %s",
            PRIMARY_OPENAI_MODEL,
            primary_exc,
            FALLBACK_OPENAI_MODEL,
        )

    # --- Tier 2: OpenAI gpt-4o-mini ---
    try:
        return _chat_openai(messages, FALLBACK_OPENAI_MODEL)
    except Exception as fallback_exc:
        if not _provider_fallback_eligible(fallback_exc):
            raise AIServiceError(
                _format_openai_error(fallback_exc, FALLBACK_OPENAI_MODEL)
            ) from fallback_exc
        logger.warning(
            "ai_chat: OpenAI %s failed (%s); falling back to Gemini %s",
            FALLBACK_OPENAI_MODEL,
            fallback_exc,
            _gemini_model_name(),
        )

    # --- Tier 3: Google Gemini ---
    try:
        return _chat_gemini(messages)
    except Exception as gemini_exc:
        raise AIServiceError(
            f"All chat providers failed. Last error (Gemini {_gemini_model_name()}): "
            f"{gemini_exc}"
        ) from gemini_exc


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


# Backward-compat aliases — existing callers import these names.
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


def search_documents_for_profile(
    query: str,
    user_id: Optional[str] = None,
    limit: int = 8,
    match_threshold: float = 0.35,
) -> List[Dict[str, Any]]:
    """
    RAG search tuned for profile generation: more matches, lower threshold.
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
                    "match_threshold": match_threshold,
                    "filter": {},
                },
            ).execute()
            return response.data or []
        except Exception:
            response = (
                supabase.table("conversation")
                .select("content, metadata")
                .order("created_at", desc=True)
                .limit(limit)
                .execute()
            )
            return response.data or []
    except Exception as e:
        logger.warning("Profile RAG search failed: %s", e)
        return []


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
