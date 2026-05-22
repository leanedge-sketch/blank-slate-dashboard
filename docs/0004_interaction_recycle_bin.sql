-- Recycle bin for CRM interactions removed from the UI.
-- Run once in Supabase SQL Editor (Dashboard → SQL → New query).
-- Deletes in the app copy the row here, then remove it from public.interactions.

CREATE TABLE IF NOT EXISTS public.interaction_recycle_bin (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    original_interaction_id UUID NOT NULL,
    customer_id UUID NOT NULL,
    user_id UUID,
    input_text TEXT,
    ai_response TEXT,
    file_url TEXT,
    file_type TEXT,
    tds_id UUID,
    pipeline_id UUID,
    interaction_created_at TIMESTAMPTZ,
    interaction_updated_at TIMESTAMPTZ,
    deleted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_by UUID,
    deletion_reason TEXT DEFAULT 'removed_from_ui',
    raw_payload JSONB NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_interaction_recycle_bin_customer
    ON public.interaction_recycle_bin (customer_id);

CREATE INDEX IF NOT EXISTS idx_interaction_recycle_bin_deleted_at
    ON public.interaction_recycle_bin (deleted_at DESC);

CREATE INDEX IF NOT EXISTS idx_interaction_recycle_bin_original_id
    ON public.interaction_recycle_bin (original_interaction_id);

COMMENT ON TABLE public.interaction_recycle_bin IS
    'Archived CRM interactions removed from the app UI; review and purge here in Supabase.';
