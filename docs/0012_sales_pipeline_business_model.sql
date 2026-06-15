-- Align sales_pipeline.business_model CHECK with Business_Model lookup table.
-- Fixes: violates check constraint "sales_pipeline_business_model_check"
-- when saving values like "Manufacturer" that exist in Business_Model but not
-- in the original static whitelist ('SEZ Import', 'Local Stock').

ALTER TABLE public.sales_pipeline
DROP CONSTRAINT IF EXISTS sales_pipeline_business_model_check;

CREATE OR REPLACE FUNCTION public.sales_pipeline_business_model_valid(p_model text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  IF p_model IS NULL OR btrim(p_model) = '' THEN
    RETURN TRUE;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'Business_Model'
  ) THEN
    IF EXISTS (
      SELECT 1
      FROM public."Business_Model" bm
      WHERE btrim(bm."Name") = btrim(p_model)
    ) THEN
      RETURN TRUE;
    END IF;
  END IF;

  -- Legacy whitelist (pre-lookup-table rows and fallback when table is empty).
  IF btrim(p_model) IN (
    'SEZ Import',
    'Local Stock',
    'Manufacturer',
    'Distributor',
    'Trader',
    'Agency',
    'Stock',
    'Direct Delivery'
  ) THEN
    RETURN TRUE;
  END IF;

  RETURN FALSE;
END;
$$;

ALTER TABLE public.sales_pipeline
ADD CONSTRAINT sales_pipeline_business_model_check
CHECK (public.sales_pipeline_business_model_valid(business_model)) NOT VALID;

ALTER TABLE public.sales_pipeline
VALIDATE CONSTRAINT sales_pipeline_business_model_check;
