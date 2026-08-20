-- Mirror of migrations/002_home_summary_cache.sql

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS public.home_summary_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  summary_markdown text NOT NULL,
  metrics_payload jsonb NOT NULL,
  provider_used text NOT NULL DEFAULT 'gemini',
  is_fallback boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + INTERVAL '15 minutes')
);

CREATE INDEX IF NOT EXISTS idx_home_summary_cache_created
  ON public.home_summary_cache (created_at DESC);

GRANT SELECT, INSERT ON public.home_summary_cache TO service_role;
GRANT SELECT ON public.home_summary_cache TO authenticated;
