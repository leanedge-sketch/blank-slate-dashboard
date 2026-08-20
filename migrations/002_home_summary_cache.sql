-- Home At a Glance summary cache (15-minute AI synthesis).
-- Paste into Supabase SQL Editor. Safe to re-run.

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

CREATE INDEX IF NOT EXISTS idx_home_summary_cache_expires
  ON public.home_summary_cache (expires_at DESC);

GRANT SELECT, INSERT ON public.home_summary_cache TO service_role;
GRANT SELECT ON public.home_summary_cache TO authenticated;

COMMENT ON TABLE public.home_summary_cache IS
  'Cached home launcher At a Glance cards. Worker refreshes every 15 minutes.';
