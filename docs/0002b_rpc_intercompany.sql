-- docs/0002b_rpc_intercompany.sql
-- =============================================================================
-- RPC: insert_intercompany_transfer
-- =============================================================================
-- RUN THIS FROM: Supabase Dashboard -> SQL Editor.
-- Prereqs:
--   * docs/0001_enums_and_integrity.sql  (enums + CHECKs)
--   * docs/0002_intercompany_transfers.sql (paired_movement_id + trigger)
--
-- PURPOSE
-- -------
-- The PostgREST client (supabase-py / supabase-js) wraps every REST call in
-- its own implicit transaction. The constraint trigger
-- `validate_stock_transfer_pair` is DEFERRABLE INITIALLY DEFERRED, so it
-- fires at COMMIT. Two separate client INSERTs therefore COMMIT between
-- them — the first leg always fails the "paired row must exist" rule.
--
-- This SECURITY DEFINER function executes BOTH inserts inside ONE
-- transaction so the deferred trigger validates the complete pair at the
-- single closing COMMIT. The Streamlit view calls it via
-- ``supabase.rpc('insert_intercompany_transfer', { ... })``.
--
-- SECURITY MODEL
-- --------------
-- * SECURITY DEFINER + locked `search_path = public, pg_temp` prevents
--   search-path hijack attacks.
-- * Function owner should be the migration role (e.g. `postgres`), NOT a
--   user role. EXECUTE is granted to `authenticated` and `service_role`.
-- * All parameter values flow through bound placeholders — no dynamic SQL,
--   so the function is immune to SQL injection by construction.
-- * Inputs are validated up-front (positive qty, distinct locations, known
--   enum values, non-null product) before any write occurs, so the trigger
--   only ever sees well-formed candidate rows.
--
-- ERROR CONTRACT
-- --------------
-- The function raises one of these SQLSTATE codes, which surface in the
-- PostgREST response body as { code, message, details, hint } and reach
-- the Streamlit client as ``postgrest.exceptions.APIError``:
--
--   22023  invalid_parameter_value   -- bad input (caught pre-INSERT)
--   23514  check_violation           -- CHECK constraint rejected a row
--   P0001  raise_exception           -- pair trigger rejected the pair
--   XX000  internal_error            -- unexpected; details echo SQLSTATE
-- =============================================================================

BEGIN;

-- Drop prior signatures so re-runs are idempotent even if the arg list changed.
DROP FUNCTION IF EXISTS public.insert_intercompany_transfer(
    uuid, date, text, text, numeric, text, text, text
);

CREATE OR REPLACE FUNCTION public.insert_intercompany_transfer(
    p_product_id            uuid,
    p_date                  date,
    p_source_location       text,
    p_destination_location  text,
    p_quantity_kg           numeric,
    p_unit                  text DEFAULT 'kg',
    p_reference             text DEFAULT NULL,
    p_remark                text DEFAULT NULL
)
RETURNS TABLE (source_id uuid, destination_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_src              uuid := gen_random_uuid();
    v_dst              uuid := gen_random_uuid();
    v_allowed_locs     constant text[] := ARRAY['addis_ababa','sez_kenya','nairobi_partner'];
    v_allowed_units    constant text[] := ARRAY['kg','ton','g','lb','oz','piece','unit'];
    v_product_exists   boolean;
BEGIN
    -- =====================================================================
    -- 1. PRE-FLIGHT VALIDATION
    --    Fail fast with SQLSTATE 22023 (invalid_parameter_value) so the
    --    PostgREST client sees a structured 400 instead of a generic 500.
    -- =====================================================================
    IF p_product_id IS NULL THEN
        RAISE EXCEPTION 'product_id is required'
            USING ERRCODE = '22023', HINT = 'Pass a valid products.id UUID.';
    END IF;

    IF p_date IS NULL THEN
        RAISE EXCEPTION 'date is required'
            USING ERRCODE = '22023';
    END IF;

    IF p_quantity_kg IS NULL OR p_quantity_kg <= 0 THEN
        RAISE EXCEPTION 'quantity_kg must be > 0 (got %)', p_quantity_kg
            USING ERRCODE = '22023',
                  HINT    = 'Transfers cannot be zero or negative.';
    END IF;

    IF NOT (p_source_location = ANY(v_allowed_locs)) THEN
        RAISE EXCEPTION 'source_location % is not a recognized location', p_source_location
            USING ERRCODE = '22023',
                  HINT    = 'Allowed: addis_ababa, sez_kenya, nairobi_partner.';
    END IF;

    IF NOT (p_destination_location = ANY(v_allowed_locs)) THEN
        RAISE EXCEPTION 'destination_location % is not a recognized location', p_destination_location
            USING ERRCODE = '22023',
                  HINT    = 'Allowed: addis_ababa, sez_kenya, nairobi_partner.';
    END IF;

    IF p_source_location = p_destination_location THEN
        RAISE EXCEPTION 'source_location and destination_location must differ (both = %)', p_source_location
            USING ERRCODE = '22023';
    END IF;

    IF NOT (COALESCE(p_unit, 'kg') = ANY(v_allowed_units)) THEN
        RAISE EXCEPTION 'unit % is not a recognized unit', p_unit
            USING ERRCODE = '22023',
                  HINT    = 'Allowed: kg, ton, g, lb, oz, piece, unit.';
    END IF;

    SELECT EXISTS(SELECT 1 FROM public.products WHERE id = p_product_id)
        INTO v_product_exists;
    IF NOT v_product_exists THEN
        RAISE EXCEPTION 'product_id % does not exist', p_product_id
            USING ERRCODE = '22023';
    END IF;

    -- =====================================================================
    -- 2. ATOMIC DOUBLE-ENTRY INSERT
    --    Both rows in ONE transaction. The DEFERRED constraint trigger
    --    `validate_stock_transfer_pair` fires once at the closing COMMIT
    --    and sees BOTH rows, so symmetry/balance/location-mirroring all
    --    validate against a complete pair.
    -- =====================================================================
    BEGIN
        INSERT INTO public.stock_movements (
            id, product_id, date,
            location, transfer_to_location, transaction_type,
            unit, beginning_balance,
            purchase_kg, sold_kg,
            purchase_direct_shipment_kg, sold_direct_shipment_kg,
            sample_or_damage_kg, inter_company_transfer_kg,
            balance_kg,
            reference, remark,
            paired_movement_id
        ) VALUES
            -- SOURCE LEG: debits source location, points at destination
            (v_src, p_product_id, p_date,
             p_source_location, p_destination_location, 'Inter-company transfer',
             COALESCE(p_unit, 'kg'), 0,
             0, 0,
             0, 0,
             0, p_quantity_kg,
             0,
             p_reference, p_remark,
             v_dst),
            -- DESTINATION LEG: credits destination location, points at source
            (v_dst, p_product_id, p_date,
             p_destination_location, NULL, 'Inter-company transfer',
             COALESCE(p_unit, 'kg'), 0,
             0, 0,
             0, 0,
             0, p_quantity_kg,
             0,
             p_reference, p_remark,
             v_src);

    EXCEPTION
        -- ---------------------------------------------------------------
        -- Structured rethrows: preserve SQLSTATE so PostgREST surfaces
        -- the right HTTP code, and enrich the message with pair context.
        -- ---------------------------------------------------------------
        WHEN check_violation THEN
            RAISE EXCEPTION
                'Transfer rejected by CHECK constraint: %', SQLERRM
                USING ERRCODE = '23514',
                      HINT    = format(
                          'Pair %s ⇄ %s, product=%s, %s kg, %s -> %s',
                          v_src, v_dst, p_product_id,
                          p_quantity_kg, p_source_location, p_destination_location
                      );

        WHEN foreign_key_violation THEN
            RAISE EXCEPTION
                'Transfer rejected by foreign key: %', SQLERRM
                USING ERRCODE = '23503',
                      HINT    = 'Verify product_id (and supplier/customer if set) reference existing rows.';

        WHEN raise_exception THEN
            -- This is what `validate_stock_transfer_pair` throws.
            RAISE EXCEPTION
                'Transfer pair rejected by trigger: %', SQLERRM
                USING ERRCODE = 'P0001',
                      HINT    = format(
                          'Pair %s ⇄ %s did not satisfy the double-entry trigger. '
                          'Check that quantities balance and locations mirror.',
                          v_src, v_dst
                      );

        WHEN OTHERS THEN
            RAISE EXCEPTION
                'Unexpected error inserting transfer pair (% / %): %',
                SQLSTATE, v_src, SQLERRM
                USING ERRCODE = 'XX000';
    END;

    -- =====================================================================
    -- 3. Return both ids so the client can link references / receipts.
    -- =====================================================================
    RETURN QUERY SELECT v_src, v_dst;
END;
$$;

-- -----------------------------------------------------------------------------
-- Permissions
-- -----------------------------------------------------------------------------
-- Strip default PUBLIC execute, then grant explicitly to expected roles.
REVOKE ALL ON FUNCTION public.insert_intercompany_transfer(
    uuid, date, text, text, numeric, text, text, text
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.insert_intercompany_transfer(
    uuid, date, text, text, numeric, text, text, text
) TO authenticated, service_role;

COMMENT ON FUNCTION public.insert_intercompany_transfer(
    uuid, date, text, text, numeric, text, text, text
) IS
'Atomically inserts BOTH legs of an inter-company stock transfer in a single
transaction so the DEFERRED trigger `validate_stock_transfer_pair` can validate
the pair at COMMIT. Returns (source_id, destination_id). Raises 22023 for bad
inputs, 23514 for CHECK violations, P0001 for trigger rejections.';

COMMIT;

-- =============================================================================
-- SMOKE TEST (run manually, replace the product UUID)
-- =============================================================================
-- SELECT * FROM public.insert_intercompany_transfer(
--     p_product_id           => '00000000-0000-0000-0000-000000000000'::uuid,
--     p_date                 => CURRENT_DATE,
--     p_source_location      => 'sez_kenya',
--     p_destination_location => 'addis_ababa',
--     p_quantity_kg          => 250.0,
--     p_unit                 => 'kg',
--     p_reference            => 'TEST-DO-001',
--     p_remark               => 'RPC smoke test'
-- );
--
-- Expected:
--   * Two new rows in stock_movements, paired_movement_id symmetric.
--   * SUM(signed_quantity_kg) over the pair = 0.
--   * No 'BACKFILL:0002' reference (those came from the historical backfill).
-- =============================================================================
