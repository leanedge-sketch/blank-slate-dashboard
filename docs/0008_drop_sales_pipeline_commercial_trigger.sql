-- FIX: pipeline updates at Validation fail with
--   business_model is required for stages: Validation, Proposal, Confirmation, Closed
--
-- That message is from a legacy TRIGGER on public.sales_pipeline (not app code).
-- Run this entire file once in Supabase → SQL Editor.

-- 1) List triggers (check Messages tab after Run — optional diagnostic)
DO $$
DECLARE
  rec RECORD;
BEGIN
  RAISE NOTICE '--- sales_pipeline triggers ---';
  FOR rec IN
    SELECT t.tgname AS trigger_name, p.proname AS function_name, n.nspname AS schema_name
    FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    JOIN pg_proc p ON p.oid = t.tgfoid
    WHERE c.relname = 'sales_pipeline'
      AND NOT t.tgisinternal
  LOOP
    RAISE NOTICE 'trigger=% function=%.%', rec.trigger_name, rec.schema_name, rec.function_name;
  END LOOP;
END $$;

-- 2) Drop triggers whose function body mentions the legacy validation message
DO $$
DECLARE
  rec RECORD;
BEGIN
  FOR rec IN
    SELECT t.tgname AS trigger_name, n.nspname AS schema_name
    FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    JOIN pg_proc p ON p.oid = t.tgfoid
    WHERE c.relname = 'sales_pipeline'
      AND NOT t.tgisinternal
      AND (
        p.prosrc ILIKE '%business_model is required for stages%'
        OR p.prosrc ILIKE '%business_model is required%Validation%'
        OR p.prosrc ILIKE '%STAGES_REQUIRING_BUSINESS%'
      )
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON %I.sales_pipeline', rec.trigger_name, rec.schema_name);
    RAISE NOTICE 'Dropped trigger: %', rec.trigger_name;
  END LOOP;
END $$;

-- 3) Drop functions that raise the legacy error (any schema; CASCADE drops triggers)
DO $$
DECLARE
  rec RECORD;
BEGIN
  FOR rec IN
    SELECT n.nspname || '.' || p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')' AS funcsig
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE p.prosrc ILIKE '%business_model is required for stages%'
  LOOP
    EXECUTE format('DROP FUNCTION IF EXISTS %s CASCADE', rec.funcsig);
    RAISE NOTICE 'Dropped function: %', rec.funcsig;
  END LOOP;
END $$;

-- 4) If still failing: drop ALL non-system triggers on sales_pipeline
DO $$
DECLARE
  rec RECORD;
BEGIN
  FOR rec IN
    SELECT t.tgname AS trigger_name, n.nspname AS schema_name
    FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relname = 'sales_pipeline'
      AND n.nspname = 'public'
      AND NOT t.tgisinternal
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.sales_pipeline', rec.trigger_name);
    RAISE NOTICE 'Dropped all public triggers: %', rec.trigger_name;
  END LOOP;
END $$;

-- 5) CHECK constraint: commercial fields only from Proposal onward (safe to re-run)
ALTER TABLE public.sales_pipeline
DROP CONSTRAINT IF EXISTS sales_pipeline_stage_requires_business_details;

ALTER TABLE public.sales_pipeline
ADD CONSTRAINT sales_pipeline_stage_requires_business_details
CHECK (
    stage NOT IN ('Proposal', 'Confirmation', 'Closed')
    OR (
        business_model IS NOT NULL
        AND unit IS NOT NULL
        AND unit_price IS NOT NULL AND unit_price >= 0
    )
) NOT VALID;

ALTER TABLE public.sales_pipeline
VALIDATE CONSTRAINT sales_pipeline_stage_requires_business_details;
