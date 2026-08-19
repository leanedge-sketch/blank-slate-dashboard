-- =============================================================================
-- AI guardrails, feature flags, and usage telemetry
-- =============================================================================
-- Run in Supabase SQL Editor (also mirrored at docs/0027_ai_guardrails_and_settings.sql).
-- Safe to re-run.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS public.app_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  value jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.ai_usage_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  provider text NOT NULL CHECK (provider IN ('gemini', 'openai')),
  model text,
  task_type text,
  input_tokens integer,
  output_tokens integer,
  estimated_cost_usd numeric(10, 6),
  status text NOT NULL CHECK (
    status IN ('success', 'fallback_triggered', 'error', 'killswitch_active')
  ),
  latency_ms integer
);

CREATE INDEX IF NOT EXISTS ai_usage_logs_created_at_idx
  ON public.ai_usage_logs (created_at DESC);

CREATE INDEX IF NOT EXISTS ai_usage_logs_provider_status_idx
  ON public.ai_usage_logs (provider, status);

INSERT INTO public.app_settings (key, value)
VALUES
  ('emergency_ai_killswitch', 'false'::jsonb),
  ('enable_ai_summaries', 'true'::jsonb),
  ('enable_ai_icp', 'true'::jsonb),
  ('monthly_budget_cap_usd', '50.00'::jsonb),
  ('current_month_spend_usd', '0.00'::jsonb),
  ('budget_alert_level', '0'::jsonb)
ON CONFLICT (key) DO NOTHING;

GRANT SELECT, INSERT, UPDATE ON public.app_settings TO service_role;
GRANT SELECT ON public.app_settings TO authenticated;

GRANT SELECT, INSERT ON public.ai_usage_logs TO service_role;
GRANT SELECT ON public.ai_usage_logs TO authenticated;

COMMENT ON TABLE public.app_settings IS
  'Feature flags and AI budget telemetry for LeanChem Connect orchestration.';
COMMENT ON TABLE public.ai_usage_logs IS
  'Per-call AI provider usage, estimated cost, and failover status.';
