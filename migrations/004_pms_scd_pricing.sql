-- SCD Type 2 pricing on the live PMS junction table (`pricing_records`).
-- There is no `product_pricing` table in this app; a compatibility view is
-- created with product_id / partner_id aliases. Paste into Supabase SQL Editor.

ALTER TABLE public.pricing_records
  ADD COLUMN IF NOT EXISTS active_from TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS expired_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS is_current BOOLEAN NOT NULL DEFAULT true;

-- Backfill from existing validity / status columns.
UPDATE public.pricing_records
SET
  active_from = COALESCE(active_from, valid_from::timestamptz, created_at, now()),
  expired_at = CASE
    WHEN status = 'historical' THEN COALESCE(expired_at, valid_to::timestamptz, updated_at, now())
    ELSE expired_at
  END,
  is_current = CASE
    WHEN status = 'active' THEN true
    ELSE false
  END;

CREATE INDEX IF NOT EXISTS idx_product_pricing_current
  ON public.pricing_records (pms_product_id, crm_partner_id)
  WHERE is_current = true;

CREATE INDEX IF NOT EXISTS idx_pricing_records_is_current
  ON public.pricing_records (is_current, crm_partner_id);

CREATE OR REPLACE VIEW public.product_pricing AS
SELECT
  id,
  pms_product_id AS product_id,
  crm_partner_id AS partner_id,
  supplier_partner_id,
  partner_kind,
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
  active_from,
  expired_at,
  is_current,
  created_at,
  updated_at
FROM public.pricing_records;

GRANT SELECT ON public.product_pricing TO authenticated;
GRANT SELECT ON public.product_pricing TO anon;
GRANT ALL ON public.product_pricing TO service_role;

COMMENT ON COLUMN public.pricing_records.is_current IS
  'SCD Type 2: true only for the live price of a product+partner pair.';
COMMENT ON COLUMN public.pricing_records.active_from IS
  'SCD Type 2: when this version became the current price.';
COMMENT ON COLUMN public.pricing_records.expired_at IS
  'SCD Type 2: when this version was superseded. NULL while is_current.';
