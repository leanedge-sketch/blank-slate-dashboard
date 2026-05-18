"""
AI Service - OpenAI Integration and RAG Helpers
==============================================

Centralizes all AI logic for the backend:
- Chat completion via OpenAI Chat Completions API
- Text embeddings via OpenAI Embeddings API (768 dims to match pgvector schema)
- RAG helpers for the `conversation` table

Public API (unchanged so existing callers don't break):
- gemini_chat(messages) -> str
- gemini_embed(text) -> List[float]   # 768-dim
- log_conversation_to_rag(...)
- search_documents(...)
- GeminiError (raised on AI provider failures)

The historical `gemini_*` names are kept as aliases for backward compatibility.
Provider-neutral aliases `ai_chat` / `ai_embed` / `AIServiceError` are also exported.
"""

from __future__ import annotations
from typing import List, Dict, Any, Optional

from openai import OpenAI

from app.config import settings
from app.database.connection import get_supabase_service_client
from supabase import Client


CHAT_MODEL = settings.OPENAI_CHAT_MODEL or "gpt-4o-mini"
EMBED_MODEL = settings.OPENAI_EMBED_MODEL or "text-embedding-3-small"
EMBED_DIM = settings.OPENAI_EMBED_DIM or 768


class AIServiceError(Exception):
    """Raised when an AI provider call fails."""


# Backward-compat alias — existing code imports this name.
GeminiError = AIServiceError


_client: Optional[OpenAI] = None


def _get_client() -> OpenAI:
    global _client
    if _client is None:
        if not settings.OPENAI_API_KEY:
            raise AIServiceError(
                "OPENAI_API_KEY is not configured in environment/settings."
            )
        _client = OpenAI(api_key=settings.OPENAI_API_KEY)
    return _client


def ai_chat(messages: List[Dict[str, str]]) -> str:
    """
    Call OpenAI chat completion.

    messages: list of dicts like:
      {"role": "system"|"user"|"assistant", "content": "..."}

    Returns:
      The response text from the model (empty string if blocked / no content).
    """
    try:
        resp = _get_client().chat.completions.create(
            model=CHAT_MODEL,
            messages=messages,
            temperature=0.7,
        )
    except Exception as e:
        status = getattr(e, "status_code", None) or getattr(e, "code", "")
        message = getattr(e, "message", None) or str(e)
        raise AIServiceError(f"OpenAI chat error {status}: {message}".strip())

    choice = resp.choices[0] if resp.choices else None
    if not choice or not choice.message or not choice.message.content:
        return ""
    return choice.message.content


def ai_embed(text: str) -> List[float]:
    """
    Get an embedding vector for a single piece of text.

    Returns a 768-dim vector to match the existing pgvector(768) columns
    in `conversation.embedding` and `documents.embedding`.
    """
    if not text or not text.strip():
        raise AIServiceError("Cannot embed empty text")

    try:
        resp = _get_client().embeddings.create(
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
            # RPC missing — fall back to plain select so callers don't break.
            response = (
                supabase.table("conversation")
                .select("content, metadata")
                .limit(limit)
                .execute()
            )
            return response.data or []
    except Exception as e:
        print(f"Document search failed: {str(e)}")
        return []
