-- Separate procurement costing pipelines from sales-linked costing snapshots.
-- Run once in Supabase SQL Editor.

ALTER TABLE public.import_finance_shipments
  ADD COLUMN IF NOT EXISTS pipeline_domain text NOT NULL DEFAULT 'procurement',
  ADD COLUMN IF NOT EXISTS sales_pipeline_id uuid NULL;

ALTER TABLE public.import_finance_shipments
  DROP CONSTRAINT IF EXISTS import_finance_shipments_pipeline_domain_check;

ALTER TABLE public.import_finance_shipments
  ADD CONSTRAINT import_finance_shipments_pipeline_domain_check
  CHECK (pipeline_domain IN ('procurement', 'sales'));

CREATE INDEX IF NOT EXISTS import_finance_shipments_pipeline_domain_idx
  ON public.import_finance_shipments (pipeline_domain);

CREATE INDEX IF NOT EXISTS import_finance_shipments_sales_pipeline_idx
  ON public.import_finance_shipments (sales_pipeline_id)
  WHERE sales_pipeline_id IS NOT NULL;

COMMENT ON COLUMN public.import_finance_shipments.pipeline_domain IS
  'procurement = Trade & Transit / import costing; sales = costing snapshot linked to a CRM sales_pipeline deal.';
COMMENT ON COLUMN public.import_finance_shipments.sales_pipeline_id IS
  'Optional link to public.sales_pipeline.id when pipeline_domain = sales.';
