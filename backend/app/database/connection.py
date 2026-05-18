"""
Supabase connection helpers.

Provides two clients:
- get_supabase_client(): uses the public/anon key (SUPABASE_KEY) for standard queries
- get_supabase_service_client(): uses the service key (SUPABASE_SERVICE_KEY) for admin operations
"""

from functools import lru_cache
from supabase import create_client, Client
from app.config import settings


def _validate_supabase_env(url: str, key: str, key_name: str) -> None:
    if not url:
        raise RuntimeError("SUPABASE_URL is not configured")
    if not key:
        raise RuntimeError(f"{key_name} is not configured")


@lru_cache(maxsize=1)
def get_supabase_client() -> Client:
    """Return a cached Supabase client using the public/anon key."""
    _validate_supabase_env(settings.SUPABASE_URL, settings.SUPABASE_KEY, "SUPABASE_KEY")
    client = create_client(settings.SUPABASE_URL, settings.SUPABASE_KEY)
    return client


@lru_cache(maxsize=1)
def get_supabase_service_client() -> Client:
    """Return a cached Supabase client using the service key (for admin operations)."""
    _validate_supabase_env(
        settings.SUPABASE_URL, settings.SUPABASE_SERVICE_KEY, "SUPABASE_SERVICE_KEY"
    )
    try:
        client = create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_KEY)
        return client
    except Exception as e:
        error_msg = str(e)
        if "Invalid API key" in error_msg:
            raise RuntimeError(
                f"Invalid SUPABASE_SERVICE_KEY. Please verify your service key in backend/.env\n"
                f"URL: {settings.SUPABASE_URL}\n"
                f"Key length: {len(settings.SUPABASE_SERVICE_KEY) if settings.SUPABASE_SERVICE_KEY else 0} characters\n"
                f"Key starts with: {settings.SUPABASE_SERVICE_KEY[:20] if settings.SUPABASE_SERVICE_KEY and len(settings.SUPABASE_SERVICE_KEY) > 20 else 'N/A'}...\n"
                f"To get your service key: Supabase Dashboard > Project Settings > API > service_role key"
            ) from e
        raise


def clear_supabase_cache():
    """Clear the cached Supabase clients. Useful for testing or when credentials change."""
    get_supabase_client.cache_clear()
    get_supabase_service_client.cache_clear()


