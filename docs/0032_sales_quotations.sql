-- Sales quotation versioning (Module 5 Phase 1).
-- Numbered 006 because migrations/005_pms_scd_bulk_and_snapshots.sql already exists.
-- Paste into Supabase SQL Editor after 004/005 PMS SCD. Safe to re-run.

CREATE TABLE IF NOT EXISTS public.sales_quotations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pipeline_id UUID NOT NULL REFERENCES public.sales_pipeline(id) ON DELETE CASCADE,
    version INTEGER NOT NULL DEFAULT 1,
    target_amount NUMERIC(15, 2) NOT NULL,
    currency TEXT NOT NULL DEFAULT 'USD',
    file_url TEXT,
    is_accepted BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by UUID REFERENCES auth.users(id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_single_accepted_quote
    ON public.sales_quotations (pipeline_id)
    WHERE is_accepted = true;

CREATE UNIQUE INDEX IF NOT EXISTS idx_sales_quotations_pipeline_version
    ON public.sales_quotations (pipeline_id, version);

CREATE INDEX IF NOT EXISTS idx_sales_quotations_pipeline_created
    ON public.sales_quotations (pipeline_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.sales_quotations TO authenticated;
GRANT ALL ON public.sales_quotations TO service_role;

COMMENT ON TABLE public.sales_quotations IS
  'Versioned commercial quotes bound to a sales_pipeline deal. At most one accepted quote per deal.';
COMMENT ON COLUMN public.sales_quotations.is_accepted IS
  'True for the winning quote. Enforced by idx_single_accepted_quote.';
COMMENT ON COLUMN public.sales_quotations.target_amount IS
  'Quoted commercial amount frozen at this version; independent of later PMS price edits.';

ALTER TABLE public.sales_pipeline
  ADD COLUMN IF NOT EXISTS target_amount NUMERIC(15, 2);

COMMENT ON COLUMN public.sales_pipeline.target_amount IS
  'Accepted quotation commercial total. Distinct from amount (quantity).';
