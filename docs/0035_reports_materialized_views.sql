-- Module 8 Phase 1/2: executive reporting materialized views + briefing logs.
-- Numbered 009 because migrations/008_trade_transit_hardening.sql already exists.
-- Safe to re-run in Supabase SQL Editor.
--
-- Real LeanChem tables:
--   sales_pipeline, import_finance_shipments, products,
--   stock_balance_by_product_location (view), customers, interactions

DROP FUNCTION IF EXISTS public.refresh_executive_materialized_views();

DROP MATERIALIZED VIEW IF EXISTS public.mv_exec_crm_activity;
DROP MATERIALIZED VIEW IF EXISTS public.mv_exec_stock_alerts;
DROP MATERIALIZED VIEW IF EXISTS public.mv_exec_transit_summary;
DROP MATERIALIZED VIEW IF EXISTS public.mv_exec_sales_summary;

-- 1) Financials: Sales pipeline roll-up
CREATE MATERIALIZED VIEW public.mv_exec_sales_summary AS
SELECT
    md5(coalesce(stage::text, '') || '|' || coalesce(currency::text, '')) AS row_key,
    stage,
    currency,
    COUNT(id) AS total_deals,
    COALESCE(SUM(COALESCE(target_amount, amount, 0)), 0) AS pipeline_value_usd
FROM public.sales_pipeline
GROUP BY stage, currency;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_exec_sales_summary_row_key
    ON public.mv_exec_sales_summary (row_key);

-- 2) Financials: Procurement / transit roll-up
CREATE MATERIALIZED VIEW public.mv_exec_transit_summary AS
SELECT
    coalesce(lower(trim(status)), 'unknown') AS status,
    COUNT(id) AS active_shipments,
    COALESCE(SUM(net_landed_cost_etb), 0) AS total_transit_value
FROM public.import_finance_shipments
WHERE lower(trim(status)) IN (
    'in_transit',
    'in transit',
    'ocean transit'
)
GROUP BY 1;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_exec_transit_summary_status
    ON public.mv_exec_transit_summary (status);

-- 3) Top Stock Alerts (Addis Ababa & SEZ Kenya)
-- Uses stock_balance_by_product_location when present; otherwise empty-safe fallback.
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.views
        WHERE table_schema = 'public'
          AND table_name = 'stock_balance_by_product_location'
    ) THEN
        EXECUTE $mv$
            CREATE MATERIALIZED VIEW public.mv_exec_stock_alerts AS
            SELECT
                md5(p.id::text || '|' || bal.location) AS row_key,
                p.id AS product_id,
                coalesce(nullif(trim(p.chemical), ''), nullif(trim(p.chemical_type), ''), p.id::text) AS product_name,
                bal.location,
                bal.net_kg AS available_kg,
                coalesce(p.minimum_stock_threshold, 0)::numeric AS minimum_stock_threshold,
                (coalesce(p.minimum_stock_threshold, 0) - bal.net_kg) AS deficit_kg
            FROM public.products p
            JOIN public.stock_balance_by_product_location bal
              ON bal.product_id = p.id
            WHERE bal.location IN ('addis_ababa', 'sez_kenya')
              AND coalesce(p.minimum_stock_threshold, 0) > 0
              AND bal.net_kg <= coalesce(p.minimum_stock_threshold, 0)
        $mv$;
    ELSE
        EXECUTE $mv$
            CREATE MATERIALIZED VIEW public.mv_exec_stock_alerts AS
            SELECT
                md5(p.id::text || '|unknown') AS row_key,
                p.id AS product_id,
                coalesce(nullif(trim(p.chemical), ''), nullif(trim(p.chemical_type), ''), p.id::text) AS product_name,
                'unknown'::text AS location,
                0::numeric AS available_kg,
                coalesce(p.minimum_stock_threshold, 0)::numeric AS minimum_stock_threshold,
                coalesce(p.minimum_stock_threshold, 0)::numeric AS deficit_kg
            FROM public.products p
            WHERE false
        $mv$;
    END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_exec_stock_alerts_row_key
    ON public.mv_exec_stock_alerts (row_key);

-- 4) CRM Activity (new customers + interactions, last 7 days)
CREATE MATERIALIZED VIEW public.mv_exec_crm_activity AS
SELECT
    'weekly'::text AS window_key,
    (
        SELECT COUNT(*)
        FROM public.customers c
        WHERE c.created_at >= (now() - interval '7 days')
    ) AS new_customers_7d,
    (
        SELECT COUNT(*)
        FROM public.interactions i
        WHERE i.created_at >= (now() - interval '7 days')
    ) AS interactions_7d,
    (
        SELECT COUNT(*)
        FROM public.customers c
    ) AS total_customers,
    now() AS refreshed_at;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_exec_crm_activity_window
    ON public.mv_exec_crm_activity (window_key);

CREATE OR REPLACE FUNCTION public.refresh_executive_materialized_views()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_exec_sales_summary;
    REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_exec_transit_summary;
    REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_exec_stock_alerts;
    REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_exec_crm_activity;
END;
$$;

-- Delivery / history log for Monday briefings
CREATE TABLE IF NOT EXISTS public.executive_briefing_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    summary_text TEXT NOT NULL,
    summary_html TEXT,
    data_json JSONB,
    provider_used TEXT,
    model_used TEXT,
    is_fallback BOOLEAN NOT NULL DEFAULT false,
    email_status TEXT NOT NULL DEFAULT 'pending',
    email_error TEXT,
    recipients TEXT[],
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_executive_briefing_logs_created
    ON public.executive_briefing_logs (created_at DESC);

GRANT SELECT ON public.mv_exec_sales_summary TO authenticated, service_role;
GRANT SELECT ON public.mv_exec_transit_summary TO authenticated, service_role;
GRANT SELECT ON public.mv_exec_stock_alerts TO authenticated, service_role;
GRANT SELECT ON public.mv_exec_crm_activity TO authenticated, service_role;
GRANT SELECT, INSERT ON public.executive_briefing_logs TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.refresh_executive_materialized_views() TO service_role;
