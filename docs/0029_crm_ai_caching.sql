-- Mirror of migrations/003_crm_ai_caching.sql

CREATE TABLE IF NOT EXISTS public.ai_context_caches (
    customer_id UUID PRIMARY KEY REFERENCES public.customers(customer_id) ON DELETE CASCADE,
    gemini_cache_name TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_ai_context_caches_expires
    ON public.ai_context_caches (expires_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_context_caches TO service_role;
GRANT SELECT ON public.ai_context_caches TO authenticated;
