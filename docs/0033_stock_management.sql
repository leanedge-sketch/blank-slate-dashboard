-- Module 6 Phase 1: FIFO batch/expiry, low-stock threshold, atomic warehouse transfer.
-- Numbered 007 because migrations/006_sales_quotations.sql already exists.
-- Paste into Supabase SQL Editor. Safe to re-run.
--
-- LeanChem stock_movements does NOT use movement_type IN/OUT.
-- Transfers are paired Inter-company transfer rows (docs/0002_intercompany_transfers.sql).
-- This RPC keeps that double-entry model inside one Postgres transaction.

ALTER TABLE public.stock_movements
  ADD COLUMN IF NOT EXISTS batch_id TEXT,
  ADD COLUMN IF NOT EXISTS expiry_date DATE;

CREATE INDEX IF NOT EXISTS stock_movements_fifo_idx
  ON public.stock_movements (product_id, expiry_date NULLS LAST, created_at)
  WHERE batch_id IS NOT NULL OR expiry_date IS NOT NULL;

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS minimum_stock_threshold NUMERIC(10, 2) NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.stock_movements.batch_id IS
  'Optional lot/batch for FIFO consumption.';
COMMENT ON COLUMN public.stock_movements.expiry_date IS
  'Optional expiry for FIFO (oldest / nearest expiry first).';
COMMENT ON COLUMN public.products.minimum_stock_threshold IS
  'Alert when total available kg is at or below this threshold.';

CREATE OR REPLACE FUNCTION public.atomic_stock_transfer(
    p_product_id UUID,
    p_source_location TEXT,
    p_dest_location TEXT,
    p_quantity NUMERIC,
    p_batch_id TEXT DEFAULT NULL,
    p_expiry_date DATE DEFAULT NULL,
    p_notes TEXT DEFAULT 'Internal Transfer'
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    src_id uuid := gen_random_uuid();
    dst_id uuid := gen_random_uuid();
    v_tds uuid;
    v_catalog uuid;
    v_today date := CURRENT_DATE;
    src_loc text;
    dst_loc text;
BEGIN
    IF p_product_id IS NULL THEN
        RAISE EXCEPTION 'Transfer failed: product is required';
    END IF;
    IF p_quantity IS NULL OR p_quantity <= 0 THEN
        RAISE EXCEPTION 'Transfer failed: quantity must be greater than 0';
    END IF;

    src_loc := lower(trim(p_source_location));
    dst_loc := lower(trim(p_dest_location));

    IF src_loc IS NULL OR dst_loc IS NULL OR src_loc = '' OR dst_loc = '' THEN
        RAISE EXCEPTION 'Transfer failed: source and destination are required';
    END IF;
    IF src_loc = dst_loc THEN
        RAISE EXCEPTION 'Transfer failed: source and destination must differ';
    END IF;
    IF src_loc NOT IN ('addis_ababa', 'sez_kenya', 'nairobi_partner')
       OR dst_loc NOT IN ('addis_ababa', 'sez_kenya', 'nairobi_partner') THEN
        RAISE EXCEPTION 'Transfer failed: unknown warehouse location';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.products WHERE id = p_product_id) THEN
        RAISE EXCEPTION 'Transfer failed: product not found';
    END IF;

    SELECT tds_id, catalog_uuid_id INTO v_tds, v_catalog
    FROM public.products
    WHERE id = p_product_id;

    -- Source OUT (paired_movement_id set up-front; FK is DEFERRABLE)
    INSERT INTO public.stock_movements (
        id,
        product_id,
        tds_id,
        catalog_uuid_id,
        date,
        location,
        transaction_type,
        transfer_to_location,
        unit,
        beginning_balance,
        purchase_kg,
        sold_kg,
        purchase_direct_shipment_kg,
        sold_direct_shipment_kg,
        sample_or_damage_kg,
        inter_company_transfer_kg,
        balance_kg,
        remark,
        reference,
        batch_id,
        expiry_date,
        paired_movement_id
    ) VALUES (
        src_id,
        p_product_id,
        v_tds,
        v_catalog,
        v_today,
        src_loc,
        'Inter-company transfer',
        dst_loc,
        'kg',
        0,
        0, 0, 0, 0, 0,
        p_quantity,
        0,
        p_notes,
        'ATOMIC_TRANSFER',
        p_batch_id,
        p_expiry_date,
        dst_id
    );

    -- Destination IN
    INSERT INTO public.stock_movements (
        id,
        product_id,
        tds_id,
        catalog_uuid_id,
        date,
        location,
        transaction_type,
        transfer_to_location,
        unit,
        beginning_balance,
        purchase_kg,
        sold_kg,
        purchase_direct_shipment_kg,
        sold_direct_shipment_kg,
        sample_or_damage_kg,
        inter_company_transfer_kg,
        balance_kg,
        remark,
        reference,
        batch_id,
        expiry_date,
        paired_movement_id
    ) VALUES (
        dst_id,
        p_product_id,
        v_tds,
        v_catalog,
        v_today,
        dst_loc,
        'Inter-company transfer',
        NULL,
        'kg',
        0,
        0, 0, 0, 0, 0,
        p_quantity,
        0,
        p_notes,
        'ATOMIC_TRANSFER',
        p_batch_id,
        p_expiry_date,
        src_id
    );

    RETURN TRUE;
EXCEPTION
    WHEN OTHERS THEN
        RAISE EXCEPTION 'Transfer failed: %', SQLERRM;
END;
$$;

REVOKE ALL ON FUNCTION public.atomic_stock_transfer(uuid, text, text, numeric, text, date, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.atomic_stock_transfer(uuid, text, text, numeric, text, date, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.atomic_stock_transfer(uuid, text, text, numeric, text, date, text) TO authenticated;
