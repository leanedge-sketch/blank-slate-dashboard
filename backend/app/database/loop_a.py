"""
Loop A / Loop B shared public-site Supabase client.

Uses NEXT_PUBLIC_* / LOOP_A_* so CRM (VITE/SUPABASE_*) can stay on a separate project.
"""
from __future__ import annotations

from functools import lru_cache

from supabase import Client, create_client

from app.config import settings


def _loop_a_url() -> str:
    return (
        settings.LOOP_A_SUPABASE_URL
        or settings.NEXT_PUBLIC_SUPABASE_URL
        or settings.SUPABASE_URL
        or ""
    )


def _loop_a_key() -> str:
    return (
        settings.LOOP_A_SUPABASE_SERVICE_KEY
        or settings.LOOP_A_SUPABASE_ANON_KEY
        or settings.NEXT_PUBLIC_SUPABASE_ANON_KEY
        or settings.SUPABASE_SERVICE_KEY
        or settings.SUPABASE_KEY
        or ""
    )


@lru_cache(maxsize=1)
def get_loop_a_supabase() -> Client:
    url = _loop_a_url()
    key = _loop_a_key()
    if not url or not key:
        raise RuntimeError(
            "Loop A Supabase is not configured. Set LOOP_A_SUPABASE_URL + "
            "LOOP_A_SUPABASE_SERVICE_KEY (or NEXT_PUBLIC_SUPABASE_URL + anon key)."
        )
    return create_client(url, key)
