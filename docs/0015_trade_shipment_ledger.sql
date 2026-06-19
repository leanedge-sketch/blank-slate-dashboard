-- Trade & Transit: shipment calculation ledger (Supabase SQL Editor).
-- =============================================================================
-- SETUP:
-- 1. Paste and run this entire script in Supabase → SQL Editor.
-- 2. Table appears under public → trade_shipment_ledger in Table Editor.
-- 3. Wire the Procurement / Trade & Transit UI to read/write this table.
-- =============================================================================
-- Stores inputs + tax-rate snapshots for dual-FX customs waterfalls, border fees,
-- inland clearance, and margin targeting. Calculated ETB outputs can be derived
-- in the app or added via future migration columns.

-- ---------------------------------------------------------------------------
-- trade_shipment_ledger
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.trade_shipment_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Identifiers & core specs
  product_sku_id uuid,
  quantity_kg numeric NOT NULL CHECK (quantity_kg > 0),
  status text NOT NULL DEFAULT 'draft',

  -- Origin & border math (USD)
  supplier_base_price_usd numeric NOT NULL,
  supplier_margin_pct numeric NOT NULL DEFAULT 0,
  transport_to_border_usd numeric NOT NULL DEFAULT 0,
  misc_border_cost_usd numeric NOT NULL DEFAULT 0,
  misc_border_reason text,

  -- Exchange rate snapshots
  snapshot_capital_rate numeric NOT NULL,
  snapshot_customs_rate numeric NOT NULL,

  -- Customs tax waterfall (rates frozen at save time; ETB base uses official rate)
  base_customs_reference_usd numeric NOT NULL,
  tax_duty_pct numeric NOT NULL DEFAULT 0.05,
  tax_scan_fee_pct numeric NOT NULL DEFAULT 0.0007,
  tax_social_fee_pct numeric NOT NULL DEFAULT 0.03,
  tax_special_goods_pct numeric NOT NULL DEFAULT 0,
  tax_wht_pct numeric NOT NULL DEFAULT 0.03,
  tax_vat_pct numeric NOT NULL DEFAULT 0.15,
  surtax_pct numeric NOT NULL DEFAULT 0,
  excise_tax_pct numeric NOT NULL DEFAULT 0,

  -- Inland & final metrics
  inland_clearance_per_kg_etb numeric NOT NULL DEFAULT 20,
  target_selling_price_etb numeric,

  created_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT trade_shipment_ledger_status_check CHECK (
    status IN ('draft', 'submitted', 'cleared', 'cancelled')
  ),
  CONSTRAINT trade_shipment_ledger_capital_rate_positive CHECK (
    snapshot_capital_rate > 0
  ),
  CONSTRAINT trade_shipment_ledger_customs_rate_positive CHECK (
    snapshot_customs_rate > 0
  )
);

CREATE INDEX IF NOT EXISTS trade_shipment_ledger_product_sku_idx
  ON public.trade_shipment_ledger (product_sku_id);

CREATE INDEX IF NOT EXISTS trade_shipment_ledger_status_idx
  ON public.trade_shipment_ledger (status);

CREATE INDEX IF NOT EXISTS trade_shipment_ledger_created_idx
  ON public.trade_shipment_ledger (created_at DESC);

COMMENT ON TABLE public.trade_shipment_ledger IS
  'Trade & Transit calculation ledger — dual FX, customs waterfall, border fees, inland & margin inputs.';

COMMENT ON COLUMN public.trade_shipment_ledger.product_sku_id IS
  'Optional link to product master (PMS SKU / import_finance_products.id).';
COMMENT ON COLUMN public.trade_shipment_ledger.snapshot_capital_rate IS
  'Parallel / capital purchase rate (ETB per USD) used for border outlay.';
COMMENT ON COLUMN public.trade_shipment_ledger.snapshot_customs_rate IS
  'Official ETB/USD rate used for assessed customs base and tax waterfall.';
COMMENT ON COLUMN public.trade_shipment_ledger.misc_border_cost_usd IS
  'Ad-hoc border fees in USD (storage, handling, etc.).';
COMMENT ON COLUMN public.trade_shipment_ledger.misc_border_reason IS
  'Human-readable label for misc_border_cost_usd (e.g. Moyale storage fee).';
COMMENT ON COLUMN public.trade_shipment_ledger.tax_special_goods_pct IS
  'Additional 15% style levy on specific goods; 0 when not applicable.';
COMMENT ON COLUMN public.trade_shipment_ledger.surtax_pct IS
  'Reserved for future surtax parity with Excel models.';
COMMENT ON COLUMN public.trade_shipment_ledger.excise_tax_pct IS
  'Reserved for future excise tax parity with Excel models.';
COMMENT ON COLUMN public.trade_shipment_ledger.target_selling_price_etb IS
  'Target selling price per kg (ETB) for margin outlook.';

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
ALTER TABLE public.trade_shipment_ledger ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS trade_shipment_ledger_authenticated_all
  ON public.trade_shipment_ledger;
CREATE POLICY trade_shipment_ledger_authenticated_all
  ON public.trade_shipment_ledger
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- ---------------------------------------------------------------------------
-- Grants (PostgREST / Table Editor)
-- ---------------------------------------------------------------------------
GRANT SELECT, INSERT, UPDATE, DELETE ON public.trade_shipment_ledger TO authenticated;
GRANT SELECT ON public.trade_shipment_ledger TO anon;
GRANT ALL ON public.trade_shipment_ledger TO service_role;
