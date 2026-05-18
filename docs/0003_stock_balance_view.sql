-- docs/0003_stock_balance_view.sql
-- =============================================================================
-- Stock Balance View
-- =============================================================================
-- Computes real-time net stock (kg) per (product_id, location) by replaying
-- the entire `stock_movements` ledger with strict per-transaction-type signs.
--
-- Sign convention (mirrors src/lib/enums.ts TRANSACTION_SIGN):
--   Purchase             -> +purchase_kg
--   Sales                -> -sold_kg
--   Sample               -> -sample_kg
--   Damage               -> -damage_kg
--   Stock Availability   -> +stock_availability_kg   (opening-balance marker)
--   Inter-company transfer:
--       SOURCE leg      (transfer_to_location IS NOT NULL) -> -inter_company_transfer_kg
--       DESTINATION leg (transfer_to_location IS NULL)     -> +inter_company_transfer_kg
--
-- Two views are exposed:
--   * stock_balance_by_product_location — granular per-(product, location)
--   * stock_balance_by_location         — KPI roll-up per location
--
-- Idempotent: safe to re-run.
-- =============================================================================

DROP VIEW IF EXISTS public.stock_balance_by_location CASCADE;
DROP VIEW IF EXISTS public.stock_balance_by_product_location CASCADE;

CREATE OR REPLACE VIEW public.stock_balance_by_product_location AS
WITH signed AS (
    SELECT
        sm.product_id,
        sm.location,
        CASE sm.transaction_type
            WHEN 'Purchase'           THEN  COALESCE(sm.purchase_kg, 0)
            WHEN 'Sales'              THEN -COALESCE(sm.sold_kg, 0)
            WHEN 'Sample'             THEN -COALESCE(sm.sample_kg, 0)
            WHEN 'Damage'             THEN -COALESCE(sm.damage_kg, 0)
            WHEN 'Stock Availability' THEN  COALESCE(sm.stock_availability_kg, 0)
            WHEN 'Inter-company transfer' THEN
                CASE
                    WHEN sm.transfer_to_location IS NOT NULL
                        THEN -COALESCE(sm.inter_company_transfer_kg, 0)
                    ELSE  COALESCE(sm.inter_company_transfer_kg, 0)
                END
            ELSE 0
        END AS delta_kg
    FROM public.stock_movements sm
)
SELECT
    product_id,
    location,
    COALESCE(SUM(delta_kg), 0)                                   AS net_kg,
    COALESCE(SUM(CASE WHEN delta_kg > 0 THEN delta_kg END), 0)   AS inflow_kg,
    COALESCE(SUM(CASE WHEN delta_kg < 0 THEN -delta_kg END), 0)  AS outflow_kg,
    COUNT(*)                                                     AS movement_count
FROM signed
GROUP BY product_id, location;

CREATE OR REPLACE VIEW public.stock_balance_by_location AS
SELECT
    location,
    COALESCE(SUM(net_kg), 0)        AS net_kg,
    COALESCE(SUM(inflow_kg), 0)     AS inflow_kg,
    COALESCE(SUM(outflow_kg), 0)    AS outflow_kg,
    COALESCE(SUM(movement_count), 0) AS movement_count
FROM public.stock_balance_by_product_location
GROUP BY location;

-- Expose to PostgREST (anon + authenticated read-only).
GRANT SELECT ON public.stock_balance_by_product_location TO anon, authenticated;
GRANT SELECT ON public.stock_balance_by_location         TO anon, authenticated;
