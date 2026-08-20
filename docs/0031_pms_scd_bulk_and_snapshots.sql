-- Bulk SCD Type 2 revise RPC + snapshot FKs on sales / procurement rows.
-- Run after migrations/004_pms_scd_pricing.sql.

ALTER TABLE public.sales_pipeline
  ADD COLUMN IF NOT EXISTS pricing_record_id uuid,
  ADD COLUMN IF NOT EXISTS snapshot_unit_price numeric;

ALTER TABLE public.import_finance_shipments
  ADD COLUMN IF NOT EXISTS pricing_record_id uuid,
  ADD COLUMN IF NOT EXISTS snapshot_pms_price numeric;

CREATE INDEX IF NOT EXISTS sales_pipeline_pricing_record_idx
  ON public.sales_pipeline (pricing_record_id);

CREATE INDEX IF NOT EXISTS import_finance_shipments_pricing_record_idx
  ON public.import_finance_shipments (pricing_record_id);

COMMENT ON COLUMN public.sales_pipeline.pricing_record_id IS
  'SCD pricing_records.id frozen when the deal/quote was created.';
COMMENT ON COLUMN public.sales_pipeline.snapshot_unit_price IS
  'Unit price copied from the SCD row at deal creation; not live-linked.';
COMMENT ON COLUMN public.import_finance_shipments.pricing_record_id IS
  'SCD pricing_records.id frozen on procurement pipeline save.';
COMMENT ON COLUMN public.import_finance_shipments.snapshot_pms_price IS
  'PMS sell/cost snapshot at save time.';

CREATE OR REPLACE FUNCTION public.revise_pricing_records_scd(p_changes jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    item jsonb;
    old_id uuid;
    src public.pricing_records%ROWTYPE;
    new_id uuid;
    inserted jsonb := '[]'::jsonb;
    now_ts timestamptz := now();
BEGIN
    IF p_changes IS NULL OR jsonb_typeof(p_changes) <> 'array' THEN
        RAISE EXCEPTION 'p_changes must be a JSON array';
    END IF;

    FOR item IN SELECT value FROM jsonb_array_elements(p_changes)
    LOOP
        old_id := (item->>'id')::uuid;
        SELECT * INTO src FROM public.pricing_records WHERE id = old_id FOR UPDATE;
        IF NOT FOUND THEN
            RAISE EXCEPTION 'Pricing record % not found', old_id;
        END IF;

        UPDATE public.pricing_records
        SET
            is_current = false,
            expired_at = now_ts,
            valid_to = CURRENT_DATE,
            status = 'historical',
            updated_at = now_ts
        WHERE id = old_id;

        INSERT INTO public.pricing_records (
            crm_partner_id,
            partner_kind,
            supplier_partner_id,
            pms_product_id,
            incoterm,
            location_id,
            cost_currency,
            cost_amount,
            price_currency,
            price_amount,
            needs_currency_conversion,
            exchange_rate_used,
            base_currency,
            valid_from,
            valid_to,
            status,
            is_current,
            active_from,
            expired_at,
            updated_at
        ) VALUES (
            src.crm_partner_id,
            src.partner_kind,
            src.supplier_partner_id,
            src.pms_product_id,
            COALESCE(NULLIF(item->>'incoterm', ''), src.incoterm),
            src.location_id,
            COALESCE(NULLIF(item->>'cost_currency', ''), src.cost_currency),
            COALESCE((item->>'cost_amount')::numeric, src.cost_amount),
            COALESCE(NULLIF(item->>'price_currency', ''), src.price_currency),
            COALESCE((item->>'price_amount')::numeric, src.price_amount),
            src.needs_currency_conversion,
            src.exchange_rate_used,
            src.base_currency,
            CURRENT_DATE,
            NULL,
            'active',
            true,
            now_ts,
            NULL,
            now_ts
        )
        RETURNING id INTO new_id;

        inserted := inserted || jsonb_build_array(
            jsonb_build_object('old_id', old_id, 'new_id', new_id)
        );
    END LOOP;

    RETURN jsonb_build_object('revisions', inserted);
END;
$$;

REVOKE ALL ON FUNCTION public.revise_pricing_records_scd(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.revise_pricing_records_scd(jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.revise_pricing_records_scd(jsonb) TO authenticated;
