-- Module 7 Phase 1/2 foundation: procurement draft persistence + anomaly audit log.
-- Numbered 008 because migrations/007_stock_management.sql already exists.
-- Paste into Supabase SQL Editor. Safe to re-run.

CREATE TABLE IF NOT EXISTS public.procurement_pipeline_drafts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT DEFAULT 'Untitled Draft',
    wizard_state JSONB NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_procurement_drafts_user
    ON public.procurement_pipeline_drafts(user_id);

CREATE TABLE IF NOT EXISTS public.transit_cost_anomalies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shipment_id UUID REFERENCES public.import_finance_shipments(id) ON DELETE CASCADE,
    anomaly_type TEXT NOT NULL,
    severity TEXT NOT NULL DEFAULT 'warning',
    message TEXT NOT NULL,
    baseline_value NUMERIC(15, 2),
    submitted_value NUMERIC(15, 2),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- If an older draft referenced procurement_pipelines, normalize the column name.
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'transit_cost_anomalies'
          AND column_name = 'pipeline_id'
    ) AND NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'transit_cost_anomalies'
          AND column_name = 'shipment_id'
    ) THEN
        ALTER TABLE public.transit_cost_anomalies
            RENAME COLUMN pipeline_id TO shipment_id;
    END IF;
END $$;
