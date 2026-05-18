-- docs/0002_intercompany_transfers.sql
-- =============================================================================
-- Inter-Company Transfer Semantics — Paired Double-Entry Ledger
-- =============================================================================
-- RUN THIS FROM: Supabase Dashboard -> SQL Editor.
-- Prereq: docs/0001_enums_and_integrity.sql already applied.
--
-- WHY
-- ---
-- Today an "Inter-company transfer" lives as a SINGLE row in stock_movements
-- with inter_company_transfer_kg > 0 and transfer_to_location set. There is
-- no counterpart row debiting the source location, so the ledger does not
-- balance and cross-location stock totals drift over time.
--
-- This migration introduces double-entry semantics:
--   * Every transfer is represented by EXACTLY TWO rows.
--   * Both rows share the same paired_movement_id pointer (each points at
--     the OTHER row's id) — a symmetric self-FK.
--   * The two rows have equal-and-opposite signed_quantity_kg so SUM = 0.
--   * source.location = destination.transfer_to_location and vice-versa.
--
-- DESIGN CHOICE
-- -------------
-- We keep the legacy *_kg columns intact and introduce a NEW generated
-- column `signed_quantity_kg` so existing reports keep working while the
-- ledger view migrates. Once Streamlit cuts over, the legacy columns can
-- be dropped in 0003.
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 1. Column: paired_movement_id (nullable; only required for transfers)
-- -----------------------------------------------------------------------------
ALTER TABLE public.stock_movements
    ADD COLUMN IF NOT EXISTS paired_movement_id uuid NULL;

ALTER TABLE public.stock_movements
    DROP CONSTRAINT IF EXISTS stock_movements_paired_fk;

ALTER TABLE public.stock_movements
    ADD CONSTRAINT stock_movements_paired_fk
    FOREIGN KEY (paired_movement_id)
    REFERENCES public.stock_movements(id)
    ON DELETE SET NULL
    DEFERRABLE INITIALLY DEFERRED;   -- allows inserting the pair atomically

CREATE INDEX IF NOT EXISTS idx_stock_movements_paired
    ON public.stock_movements (paired_movement_id)
    WHERE paired_movement_id IS NOT NULL;

-- -----------------------------------------------------------------------------
-- 2. Generated signed_quantity_kg — the canonical ledger amount
-- -----------------------------------------------------------------------------
-- Sign convention:
--   Purchases / incoming transfers      => +qty   (stock IN)
--   Sales / outgoing transfers / sample / damage => -qty (stock OUT)
--   "Stock Availability" (opening snapshot) => 0
--
-- The source row of an inter-company transfer is negative; the destination
-- row is positive. SUM(signed) over a paired_movement_id pair = 0.
-- -----------------------------------------------------------------------------
ALTER TABLE public.stock_movements
    DROP COLUMN IF EXISTS signed_quantity_kg;

ALTER TABLE public.stock_movements
    ADD COLUMN signed_quantity_kg numeric
    GENERATED ALWAYS AS (
          COALESCE(purchase_kg, 0)
        + COALESCE(purchase_direct_shipment_kg, 0)
        - COALESCE(sold_kg, 0)
        - COALESCE(sold_direct_shipment_kg, 0)
        - COALESCE(sample_or_damage_kg, 0)
        + CASE
              WHEN transaction_type = 'Inter-company transfer'
                   AND transfer_to_location IS NOT NULL
                   AND transfer_to_location <> location
              THEN -COALESCE(inter_company_transfer_kg, 0)   -- this is the SOURCE row
              WHEN transaction_type = 'Inter-company transfer'
                   AND transfer_to_location IS NULL
              THEN  COALESCE(inter_company_transfer_kg, 0)   -- this is the DESTINATION row
              ELSE 0
          END
    ) STORED;

-- -----------------------------------------------------------------------------
-- 3. CHECK: transfer rows MUST be paired
-- -----------------------------------------------------------------------------
ALTER TABLE public.stock_movements
    DROP CONSTRAINT IF EXISTS stock_movements_transfer_pair_required;

ALTER TABLE public.stock_movements
    ADD CONSTRAINT stock_movements_transfer_pair_required
    CHECK (
        transaction_type <> 'Inter-company transfer'
        OR paired_movement_id IS NOT NULL
    ) NOT VALID;
-- Defer VALIDATE until after the backfill in section 6.

-- -----------------------------------------------------------------------------
-- 4. CHECK: non-transfer rows MUST NOT carry transfer plumbing
-- -----------------------------------------------------------------------------
ALTER TABLE public.stock_movements
    DROP CONSTRAINT IF EXISTS stock_movements_non_transfer_clean;

ALTER TABLE public.stock_movements
    ADD CONSTRAINT stock_movements_non_transfer_clean
    CHECK (
        transaction_type = 'Inter-company transfer'
        OR (paired_movement_id IS NULL
            AND COALESCE(inter_company_transfer_kg, 0) = 0
            AND transfer_to_location IS NULL)
    ) NOT VALID;

-- -----------------------------------------------------------------------------
-- 5. Trigger: enforce double-entry balance on each pair
-- -----------------------------------------------------------------------------
-- A CHECK constraint cannot span two rows, so we validate pair balance with
-- a CONSTRAINT TRIGGER fired at COMMIT time (DEFERRED). Both rows of the
-- pair must exist, mirror each other's locations, share the same date and
-- product, and sum to zero.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.validate_stock_transfer_pair()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    a public.stock_movements%ROWTYPE;
    b public.stock_movements%ROWTYPE;
BEGIN
    IF NEW.transaction_type <> 'Inter-company transfer' THEN
        RETURN NEW;
    END IF;

    IF NEW.paired_movement_id IS NULL THEN
        RAISE EXCEPTION 'Inter-company transfer % missing paired_movement_id', NEW.id;
    END IF;

    SELECT * INTO a FROM public.stock_movements WHERE id = NEW.id;
    SELECT * INTO b FROM public.stock_movements WHERE id = NEW.paired_movement_id;

    IF b.id IS NULL THEN
        RAISE EXCEPTION 'Paired movement % not found for %', NEW.paired_movement_id, NEW.id;
    END IF;

    -- Symmetric back-pointer
    IF b.paired_movement_id IS DISTINCT FROM a.id THEN
        RAISE EXCEPTION 'Pair % <-> % is not symmetric (back-pointer mismatch)', a.id, b.id;
    END IF;

    -- Same product, same business date
    IF a.product_id <> b.product_id THEN
        RAISE EXCEPTION 'Transfer pair % / % references different products', a.id, b.id;
    END IF;
    IF a.date <> b.date THEN
        RAISE EXCEPTION 'Transfer pair % / % has mismatched dates (% vs %)', a.id, b.id, a.date, b.date;
    END IF;

    -- Mirrored locations
    IF a.location = b.location THEN
        RAISE EXCEPTION 'Transfer pair % / % has identical source/destination location %', a.id, b.id, a.location;
    END IF;
    IF a.transfer_to_location IS NOT NULL
       AND a.transfer_to_location <> b.location THEN
        RAISE EXCEPTION 'Pair % transfer_to_location (%) does not match counterpart location (%)',
            a.id, a.transfer_to_location, b.location;
    END IF;

    -- Double-entry: signed quantities must sum to zero
    IF COALESCE(a.signed_quantity_kg, 0) + COALESCE(b.signed_quantity_kg, 0) <> 0 THEN
        RAISE EXCEPTION 'Transfer pair % / % does not balance: % + % <> 0',
            a.id, b.id, a.signed_quantity_kg, b.signed_quantity_kg;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS stock_movements_pair_balance ON public.stock_movements;

CREATE CONSTRAINT TRIGGER stock_movements_pair_balance
AFTER INSERT OR UPDATE OF
    paired_movement_id, transaction_type, location, transfer_to_location,
    inter_company_transfer_kg, product_id, date
ON public.stock_movements
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION public.validate_stock_transfer_pair();

-- -----------------------------------------------------------------------------
-- 6. BACKFILL STRATEGY — historical single-row transfers
-- -----------------------------------------------------------------------------
-- Strategy:
--   (a) Find every legacy row where transaction_type = 'Inter-company transfer'
--       AND paired_movement_id IS NULL. These are the "source" half (they
--       carry transfer_to_location).
--   (b) For each, INSERT a synthetic destination row at the target location
--       with the same date / product / quantity, transfer_to_location = NULL,
--       and reference = 'BACKFILL:0002 pair of <source.id>'.
--   (c) Link both ids via paired_movement_id in a single transaction so the
--       DEFERRED trigger validates the pair atomically.
--   (d) Re-run VALIDATE on the two NOT VALID checks added above.
--
-- Run as a one-shot DO block. Idempotent: re-runs skip already-paired rows.
-- -----------------------------------------------------------------------------
DO $backfill$
DECLARE
    src record;
    new_dest_id uuid;
BEGIN
    FOR src IN
        SELECT *
        FROM public.stock_movements
        WHERE transaction_type = 'Inter-company transfer'
          AND paired_movement_id IS NULL
          AND transfer_to_location IS NOT NULL
    LOOP
        INSERT INTO public.stock_movements (
            product_id, tds_id, date,
            location, transaction_type, transfer_to_location,
            unit, beginning_balance,
            purchase_kg, sold_kg,
            purchase_direct_shipment_kg, sold_direct_shipment_kg,
            sample_or_damage_kg, inter_company_transfer_kg,
            balance_kg,
            supplier_id, supplier_name, customer_id, customer_name,
            business_model, brand,
            reference, remark, warehouse,
            paired_movement_id
        ) VALUES (
            src.product_id, src.tds_id, src.date,
            src.transfer_to_location, 'Inter-company transfer', NULL,
            COALESCE(src.unit, 'kg'), 0,
            0, 0,
            0, 0,
            0, src.inter_company_transfer_kg,
            0,    -- balance recomputed by stock_service after backfill
            src.supplier_id, src.supplier_name, src.customer_id, src.customer_name,
            src.business_model, src.brand,
            'BACKFILL:0002 pair of ' || src.id::text,
            'Auto-generated destination leg for legacy single-row transfer',
            src.warehouse,
            src.id          -- back-pointer to source
        )
        RETURNING id INTO new_dest_id;

        UPDATE public.stock_movements
        SET paired_movement_id = new_dest_id
        WHERE id = src.id;
    END LOOP;
END
$backfill$;

-- -----------------------------------------------------------------------------
-- 7. Now safe to VALIDATE the deferred CHECKs
-- -----------------------------------------------------------------------------
ALTER TABLE public.stock_movements
    VALIDATE CONSTRAINT stock_movements_transfer_pair_required;

ALTER TABLE public.stock_movements
    VALIDATE CONSTRAINT stock_movements_non_transfer_clean;

-- -----------------------------------------------------------------------------
-- 8. Convenience view: balanced ledger
-- -----------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.v_stock_ledger AS
SELECT
    id,
    product_id,
    tds_id,
    date,
    location,
    transaction_type,
    transfer_to_location,
    paired_movement_id,
    signed_quantity_kg,
    unit,
    supplier_id, customer_id,
    business_model, brand, reference, remark
FROM public.stock_movements;

COMMENT ON COLUMN public.stock_movements.paired_movement_id IS
    'Self-FK to counterpart row for Inter-company transfers. NULL for all other transaction types. Enforced symmetric by trigger validate_stock_transfer_pair.';

COMMENT ON COLUMN public.stock_movements.signed_quantity_kg IS
    'Canonical signed ledger quantity. SUM over a paired transfer = 0. Use this in all running-balance queries instead of the legacy *_kg columns.';

COMMIT;

-- =============================================================================
-- POST-MIGRATION CHECKS — run these manually to verify:
-- =============================================================================
-- 1. No unpaired transfers remain:
--      SELECT count(*) FROM stock_movements
--      WHERE transaction_type = 'Inter-company transfer' AND paired_movement_id IS NULL;
--      -- expect 0
--
-- 2. Every pair balances:
--      SELECT paired_movement_id, SUM(signed_quantity_kg) AS net
--      FROM stock_movements
--      WHERE transaction_type = 'Inter-company transfer'
--      GROUP BY paired_movement_id
--      HAVING SUM(signed_quantity_kg) <> 0;
--      -- expect 0 rows
--
-- 3. Per-location running balance is internally consistent with the legacy
--    balance_kg snapshots (within a small float tolerance):
--      SELECT product_id, location,
--             SUM(signed_quantity_kg) AS computed_balance
--      FROM stock_movements
--      GROUP BY product_id, location;
-- =============================================================================
