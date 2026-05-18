-- docs/0001_enums_and_integrity.sql
-- =============================================================================
-- Enums, CHECK constraints, and integrity indexes
-- =============================================================================
-- RUN THIS FROM: Supabase Dashboard -> SQL Editor.
-- (File lives under docs/ rather than supabase/migrations/ because this repo's
-- Supabase migration runner is reserved for the Lovable-managed project; this
-- script targets your separately-managed Supabase backend.)
--
-- This migration mirrors backend/app/models/enums.py at the database layer so
-- bad values cannot enter the system from any client (Streamlit, FastAPI,
-- Cursor scripts, direct SQL). It also enforces the SCD2 invariant on
-- sales_pipeline: at most ONE current version per chain.
--
-- DESIGN CHOICE: CHECK constraints over native PG ENUM types because
-- (a) CHECKs are easier to evolve (DROP/ADD CONSTRAINT) than ALTER TYPE …
--     ADD VALUE, which is non-transactional and irreversible.
-- (b) PostgREST exposes CHECK-validated text columns cleanly to Streamlit
--     with no ENUM-cast gymnastics.
--
-- SAFETY: every constraint is added NOT VALID first, then VALIDATEd. Existing
-- bad rows surface in the VALIDATE block without blocking the DDL.
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 1. SALES PIPELINE — controlled vocabularies
-- -----------------------------------------------------------------------------
ALTER TABLE public.sales_pipeline
    DROP CONSTRAINT IF EXISTS sales_pipeline_stage_check,
    DROP CONSTRAINT IF EXISTS sales_pipeline_currency_check,
    DROP CONSTRAINT IF EXISTS sales_pipeline_forex_check,
    DROP CONSTRAINT IF EXISTS sales_pipeline_business_unit_check,
    DROP CONSTRAINT IF EXISTS sales_pipeline_incoterm_check,
    DROP CONSTRAINT IF EXISTS sales_pipeline_business_model_check;

ALTER TABLE public.sales_pipeline
    ADD CONSTRAINT sales_pipeline_stage_check
        CHECK (stage IN (
            'Lead ID','Discovery','Sample','Validation',
            'Proposal','Confirmation','Closed','Lost'
        )) NOT VALID,
    ADD CONSTRAINT sales_pipeline_currency_check
        CHECK (currency IS NULL OR currency IN ('ETB','KES','USD','EUR')) NOT VALID,
    ADD CONSTRAINT sales_pipeline_forex_check
        CHECK (forex IS NULL OR forex IN ('LeanChems','Client')) NOT VALID,
    ADD CONSTRAINT sales_pipeline_business_unit_check
        CHECK (business_unit IS NULL OR business_unit IN (
            'Hayat','Alhadi','Bet-chem','Barracoda','Nyumb-Chem'
        )) NOT VALID,
    ADD CONSTRAINT sales_pipeline_incoterm_check
        CHECK (incoterm IS NULL OR incoterm IN (
            'Import of Record','Agency','Direct Import','Stock – Addis Ababa'
        )) NOT VALID,
    ADD CONSTRAINT sales_pipeline_business_model_check
        CHECK (business_model IS NULL OR business_model IN ('Stock','Direct Delivery')) NOT VALID;

-- Stage-dependent rule: Validation+ require model/unit/price.
ALTER TABLE public.sales_pipeline
    DROP CONSTRAINT IF EXISTS sales_pipeline_stage_requires_business_details;
ALTER TABLE public.sales_pipeline
    ADD CONSTRAINT sales_pipeline_stage_requires_business_details CHECK (
        stage NOT IN ('Validation','Proposal','Confirmation','Closed')
        OR (
            business_model IS NOT NULL
            AND unit IS NOT NULL
            AND unit_price IS NOT NULL AND unit_price >= 0
        )
    ) NOT VALID;

-- Closed pipelines must carry a close_reason.
ALTER TABLE public.sales_pipeline
    DROP CONSTRAINT IF EXISTS sales_pipeline_closed_requires_reason;
ALTER TABLE public.sales_pipeline
    ADD CONSTRAINT sales_pipeline_closed_requires_reason CHECK (
        stage <> 'Closed'
        OR (close_reason IS NOT NULL AND length(btrim(close_reason)) > 0)
    ) NOT VALID;

-- -----------------------------------------------------------------------------
-- 2. SALES PIPELINE — SCD2 single-current-version invariant
-- -----------------------------------------------------------------------------
-- Chain key = COALESCE(parent_pipeline_id, id), so root + descendants share
-- the same key. Partial unique index permits exactly one row per chain where
-- is_current_version = true.
DROP INDEX IF EXISTS public.sales_pipeline_one_current_per_chain_idx;
CREATE UNIQUE INDEX sales_pipeline_one_current_per_chain_idx
    ON public.sales_pipeline ((COALESCE(parent_pipeline_id, id)))
    WHERE is_current_version = true;

-- -----------------------------------------------------------------------------
-- 3. STOCK MOVEMENTS — controlled vocabularies
-- -----------------------------------------------------------------------------
ALTER TABLE public.stock_movements
    DROP CONSTRAINT IF EXISTS stock_movements_location_check,
    DROP CONSTRAINT IF EXISTS stock_movements_transfer_to_location_check,
    DROP CONSTRAINT IF EXISTS stock_movements_transaction_type_check,
    DROP CONSTRAINT IF EXISTS stock_movements_unit_check,
    DROP CONSTRAINT IF EXISTS stock_movements_business_model_check;

ALTER TABLE public.stock_movements
    ADD CONSTRAINT stock_movements_location_check
        CHECK (location IN ('addis_ababa','sez_kenya','nairobi_partner')) NOT VALID,
    ADD CONSTRAINT stock_movements_transfer_to_location_check
        CHECK (transfer_to_location IS NULL
               OR transfer_to_location IN ('addis_ababa','sez_kenya','nairobi_partner')) NOT VALID,
    ADD CONSTRAINT stock_movements_transaction_type_check
        CHECK (transaction_type IN (
            'Sales','Purchase','Inter-company transfer',
            'Sample','Damage','Stock Availability'
        )) NOT VALID,
    ADD CONSTRAINT stock_movements_unit_check
        CHECK (unit IN ('kg','ton','g','lb','oz','piece','unit')) NOT VALID,
    ADD CONSTRAINT stock_movements_business_model_check
        CHECK (business_model IS NULL OR business_model IN ('Stock','Direct Delivery')) NOT VALID;

-- Inter-company transfers must declare a destination distinct from origin.
ALTER TABLE public.stock_movements
    DROP CONSTRAINT IF EXISTS stock_movements_transfer_requires_destination;
ALTER TABLE public.stock_movements
    ADD CONSTRAINT stock_movements_transfer_requires_destination CHECK (
        transaction_type <> 'Inter-company transfer'
        OR (transfer_to_location IS NOT NULL AND transfer_to_location <> location)
    ) NOT VALID;

-- -----------------------------------------------------------------------------
-- 4. CRM — bound legacy customers.sales_stage to known values
-- -----------------------------------------------------------------------------
-- Per the schema critique, this column duplicates sales_pipeline.stage.
-- Constrain here, plan to drop in a follow-up migration.
ALTER TABLE public.customers
    DROP CONSTRAINT IF EXISTS customers_sales_stage_check;
ALTER TABLE public.customers
    ADD CONSTRAINT customers_sales_stage_check
        CHECK (sales_stage IS NULL OR sales_stage IN ('1','2','3','4','5','6','7')) NOT VALID;

-- -----------------------------------------------------------------------------
-- 5. VALIDATE — surface pre-existing bad rows
-- -----------------------------------------------------------------------------
-- If you have dirty data, comment this block, clean the offending rows with
-- a SELECT using the same predicate, then re-run.
ALTER TABLE public.sales_pipeline VALIDATE CONSTRAINT sales_pipeline_stage_check;
ALTER TABLE public.sales_pipeline VALIDATE CONSTRAINT sales_pipeline_currency_check;
ALTER TABLE public.sales_pipeline VALIDATE CONSTRAINT sales_pipeline_forex_check;
ALTER TABLE public.sales_pipeline VALIDATE CONSTRAINT sales_pipeline_business_unit_check;
ALTER TABLE public.sales_pipeline VALIDATE CONSTRAINT sales_pipeline_incoterm_check;
ALTER TABLE public.sales_pipeline VALIDATE CONSTRAINT sales_pipeline_business_model_check;
ALTER TABLE public.sales_pipeline VALIDATE CONSTRAINT sales_pipeline_stage_requires_business_details;
ALTER TABLE public.sales_pipeline VALIDATE CONSTRAINT sales_pipeline_closed_requires_reason;

ALTER TABLE public.stock_movements VALIDATE CONSTRAINT stock_movements_location_check;
ALTER TABLE public.stock_movements VALIDATE CONSTRAINT stock_movements_transfer_to_location_check;
ALTER TABLE public.stock_movements VALIDATE CONSTRAINT stock_movements_transaction_type_check;
ALTER TABLE public.stock_movements VALIDATE CONSTRAINT stock_movements_unit_check;
ALTER TABLE public.stock_movements VALIDATE CONSTRAINT stock_movements_business_model_check;
ALTER TABLE public.stock_movements VALIDATE CONSTRAINT stock_movements_transfer_requires_destination;

ALTER TABLE public.customers VALIDATE CONSTRAINT customers_sales_stage_check;

COMMIT;
