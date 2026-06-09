-- Align DB rules with app: commercial fields (business_model, unit, unit_price)
-- are required only from Proposal onward. Validation and earlier stages may omit them.
--
-- Run once in Supabase SQL editor after deploying app changes.

-- Remove legacy trigger if it enforced Validation+ commercial (message matched old app validator).
DROP TRIGGER IF EXISTS sales_pipeline_validate_commercial_trigger ON public.sales_pipeline;
DROP TRIGGER IF EXISTS trg_sales_pipeline_validate_commercial ON public.sales_pipeline;
DROP TRIGGER IF EXISTS sales_pipeline_before_insert_update ON public.sales_pipeline;
DROP FUNCTION IF EXISTS public.validate_sales_pipeline_commercial();
DROP FUNCTION IF EXISTS public.sales_pipeline_validate_commercial();

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
