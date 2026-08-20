-- CRM AI context cache + transactional customer merge.
-- Paste into Supabase SQL Editor. Safe to re-run.
-- customers PK is customer_id (not id).

CREATE TABLE IF NOT EXISTS public.ai_context_caches (
    customer_id UUID PRIMARY KEY REFERENCES public.customers(customer_id) ON DELETE CASCADE,
    gemini_cache_name TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_ai_context_caches_expires
    ON public.ai_context_caches (expires_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_context_caches TO service_role;
GRANT SELECT ON public.ai_context_caches TO authenticated;

COMMENT ON TABLE public.ai_context_caches IS
  'Gemini context-cache handles for CRM ICP generation. Worker/API refresh when expired.';

CREATE OR REPLACE FUNCTION public.merge_customers_txn(
    p_source uuid,
    p_target uuid,
    p_fields jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    src public.customers%ROWTYPE;
    tgt public.customers%ROWTYPE;
    v_count int;
    v_reassigned jsonb := '{}'::jsonb;
    v_choice text;
    v_conv int := 0;
BEGIN
    IF p_source IS NULL OR p_target IS NULL THEN
        RAISE EXCEPTION 'Source and target customers are required';
    END IF;
    IF p_source = p_target THEN
        RAISE EXCEPTION 'Source and target customers must be different';
    END IF;

    SELECT * INTO src FROM public.customers WHERE customer_id = p_source FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Customer not found';
    END IF;
    SELECT * INTO tgt FROM public.customers WHERE customer_id = p_target FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Customer not found';
    END IF;

    v_choice := lower(coalesce(p_fields->>'display_id', 'target'));
    IF v_choice = 'source' AND src.display_id IS NOT NULL THEN
        UPDATE public.customers SET display_id = NULL WHERE customer_id = p_source;
    END IF;

    UPDATE public.customers SET
        customer_name = CASE WHEN lower(coalesce(p_fields->>'customer_name', 'target')) = 'source'
            THEN src.customer_name ELSE tgt.customer_name END,
        display_id = CASE WHEN lower(coalesce(p_fields->>'display_id', 'target')) = 'source'
            THEN src.display_id ELSE (
                SELECT c.display_id FROM public.customers c WHERE c.customer_id = p_target
            ) END,
        website_url = CASE WHEN lower(coalesce(p_fields->>'website_url', 'target')) = 'source'
            THEN src.website_url ELSE tgt.website_url END,
        linkedin_company_url = CASE WHEN lower(coalesce(p_fields->>'linkedin_company_url', 'target')) = 'source'
            THEN src.linkedin_company_url ELSE tgt.linkedin_company_url END,
        primary_contact_name = CASE WHEN lower(coalesce(p_fields->>'primary_contact_name', 'target')) = 'source'
            THEN src.primary_contact_name ELSE tgt.primary_contact_name END,
        primary_contact_email = CASE WHEN lower(coalesce(p_fields->>'primary_contact_email', 'target')) = 'source'
            THEN src.primary_contact_email ELSE tgt.primary_contact_email END,
        primary_contact_phone = CASE WHEN lower(coalesce(p_fields->>'primary_contact_phone', 'target')) = 'source'
            THEN src.primary_contact_phone ELSE tgt.primary_contact_phone END,
        sales_stage = CASE WHEN lower(coalesce(p_fields->>'sales_stage', 'target')) = 'source'
            THEN src.sales_stage ELSE tgt.sales_stage END,
        latest_profile_text = CASE WHEN lower(coalesce(p_fields->>'latest_profile_text', 'target')) = 'source'
            THEN src.latest_profile_text ELSE tgt.latest_profile_text END,
        updated_at = now()
    WHERE customer_id = p_target;

    UPDATE public.interactions SET customer_id = p_target WHERE customer_id = p_source;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    v_reassigned := v_reassigned || jsonb_build_object('interactions', v_count);

    UPDATE public.sales_pipeline SET customer_id = p_target WHERE customer_id = p_source;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    v_reassigned := v_reassigned || jsonb_build_object('sales_pipeline', v_count);

    BEGIN
        UPDATE public.import_finance_shipments SET customer_id = p_target WHERE customer_id = p_source;
        GET DIAGNOSTICS v_count = ROW_COUNT;
        v_reassigned := v_reassigned || jsonb_build_object('import_finance_shipments', v_count);
    EXCEPTION
        WHEN undefined_table THEN
            v_reassigned := v_reassigned || jsonb_build_object('import_finance_shipments', 0);
    END;

    BEGIN
        UPDATE public.profile_update_jobs SET customer_id = p_target WHERE customer_id = p_source;
        GET DIAGNOSTICS v_count = ROW_COUNT;
        v_reassigned := v_reassigned || jsonb_build_object('profile_update_jobs', v_count);
    EXCEPTION
        WHEN undefined_table THEN
            v_reassigned := v_reassigned || jsonb_build_object('profile_update_jobs', 0);
    END;

    BEGIN
        UPDATE public.customer_profile_feedback SET customer_id = p_target WHERE customer_id = p_source;
        GET DIAGNOSTICS v_count = ROW_COUNT;
        v_reassigned := v_reassigned || jsonb_build_object('customer_profile_feedback', v_count);
    EXCEPTION
        WHEN undefined_table THEN
            v_reassigned := v_reassigned || jsonb_build_object('customer_profile_feedback', 0);
    END;

    BEGIN
        UPDATE public.conversation
        SET metadata = jsonb_set(
            coalesce(metadata::jsonb, '{}'::jsonb),
            '{customer_id}',
            to_jsonb(p_target::text),
            true
        )
        WHERE metadata->>'customer_id' = p_source::text;
        GET DIAGNOSTICS v_conv = ROW_COUNT;
        v_reassigned := v_reassigned || jsonb_build_object('conversation', v_conv);
    EXCEPTION
        WHEN undefined_table THEN
            v_reassigned := v_reassigned || jsonb_build_object('conversation', 0);
        WHEN undefined_column THEN
            v_reassigned := v_reassigned || jsonb_build_object('conversation', 0);
    END;

    DELETE FROM public.customers WHERE customer_id = p_source;

    RETURN jsonb_build_object(
        'deleted_source_id', p_source,
        'reassigned', v_reassigned
    );
END;
$$;

REVOKE ALL ON FUNCTION public.merge_customers_txn(uuid, uuid, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.merge_customers_txn(uuid, uuid, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.merge_customers_txn(uuid, uuid, jsonb) TO authenticated;
