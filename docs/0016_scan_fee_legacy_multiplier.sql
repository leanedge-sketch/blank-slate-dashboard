-- Scan fee: official assessment sheet label is 0.07% but multiplier is 0.007 on CIF.
-- Run this in Supabase SQL Editor if the calculator still shows ~1,902 scan fee
-- instead of ~19,027 for 20,000 kg @ CIF 2,718,144.
--
-- Root cause: finance_constants was seeded with scan_fee_pct = 0.0007 (true 0.07%).
-- The app loads that row and overrides the in-code default of 0.007.

-- ---------------------------------------------------------------------------
-- 1. public.finance_constants (used by the app)
-- ---------------------------------------------------------------------------
UPDATE public.finance_constants
SET
  scan_fee_pct = 0.007,
  updated_at = now()
WHERE scan_fee_pct IS DISTINCT FROM 0.007;

ALTER TABLE public.finance_constants
  ALTER COLUMN scan_fee_pct SET DEFAULT 0.007;

-- ---------------------------------------------------------------------------
-- 2. import_finance.finance_constants (older schema, if present)
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'import_finance' AND table_name = 'finance_constants'
  ) THEN
    UPDATE import_finance.finance_constants
    SET
      scan_fee_pct = 0.007,
      updated_at = now()
    WHERE scan_fee_pct IS DISTINCT FROM 0.007;

    ALTER TABLE import_finance.finance_constants
      ALTER COLUMN scan_fee_pct SET DEFAULT 0.007;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 3. trade_shipment_ledger column default (if table exists)
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'trade_shipment_ledger'
  ) THEN
    ALTER TABLE public.trade_shipment_ledger
      ALTER COLUMN tax_scan_fee_pct SET DEFAULT 0.007;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- Verify — expect scan_fee_pct = 0.007
-- ---------------------------------------------------------------------------
SELECT
  'public.finance_constants' AS source,
  scan_fee_pct,
  customs_duty_pct,
  social_fee_pct,
  vat_pct,
  updated_at
FROM public.finance_constants;
