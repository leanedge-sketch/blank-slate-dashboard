-- Import Finance pipeline tables (Supabase SQL Editor).
-- =============================================================================
-- SETUP (do once):
-- 1. Paste and run this entire script in Supabase → SQL Editor.
-- 2. Then run docs/0013b_import_finance_public_tables.sql so tables appear in
--    Table Editor (public.finance_constants, import_finance_products,
--    import_finance_shipments). The app reads from public — no extra schema
--    exposure in API settings required.
-- 3. Redeploy / hard-refresh the app. Open Import Finance — Sodium Gluconate
--    should appear in the product dropdown; Save draft shipment should work.
-- =============================================================================
-- Legacy: tables below live in schema `import_finance`. Step 2 copies them to
-- `public` for Table Editor + PostgREST default schema.

CREATE SCHEMA IF NOT EXISTS import_finance;

-- ---------------------------------------------------------------------------
-- 1. finance_constants — government tax rates & buffers (single updatable row)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS import_finance.finance_constants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  singleton boolean NOT NULL DEFAULT true UNIQUE,
  customs_duty_pct numeric NOT NULL DEFAULT 0.05,
  scan_fee_pct numeric NOT NULL DEFAULT 0.0007,
  social_fee_pct numeric NOT NULL DEFAULT 0.03,
  wht_pct numeric NOT NULL DEFAULT 0.03,
  vat_pct numeric NOT NULL DEFAULT 0.15,
  freight_insurance_buffer_pct numeric NOT NULL DEFAULT 0.10,
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE import_finance.finance_constants IS
  'Static import tax rates and freight buffer — maintain one row; update when laws change.';

INSERT INTO import_finance.finance_constants (singleton)
VALUES (true)
ON CONFLICT (singleton) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 2. products — import finance product master (chemicals / materials)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS import_finance.products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_name text NOT NULL,
  base_customs_reference_usd numeric NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS import_finance_products_name_idx
  ON import_finance.products (product_name);

COMMENT ON TABLE import_finance.products IS
  'Import finance product master — customs reference USD per kg for CIF assessment.';

-- Example seed (safe to re-run)
INSERT INTO import_finance.products (product_name, base_customs_reference_usd)
SELECT 'Sodium Gluconate', 0.792
WHERE NOT EXISTS (
  SELECT 1 FROM import_finance.products WHERE product_name = 'Sodium Gluconate'
);

-- ---------------------------------------------------------------------------
-- 3. import_shipments — ledger with rate snapshots at time of calculation
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS import_finance.import_shipments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES import_finance.products (id) ON DELETE RESTRICT,
  quantity_kg numeric NOT NULL CHECK (quantity_kg > 0),
  supplier_base_price_usd numeric NOT NULL,
  supplier_margin_pct numeric NOT NULL DEFAULT 0,
  transport_to_border_usd numeric NOT NULL,
  snapshot_official_rate numeric NOT NULL,
  snapshot_parallel_rate numeric NOT NULL,
  local_clearance_per_kg_etb numeric NOT NULL DEFAULT 20,
  status text NOT NULL DEFAULT 'draft',
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT import_shipments_status_check CHECK (
    status IN ('draft', 'submitted', 'cleared', 'cancelled')
  )
);

CREATE INDEX IF NOT EXISTS import_shipments_product_idx
  ON import_finance.import_shipments (product_id);

CREATE INDEX IF NOT EXISTS import_shipments_status_idx
  ON import_finance.import_shipments (status);

CREATE INDEX IF NOT EXISTS import_shipments_created_idx
  ON import_finance.import_shipments (created_at DESC);

COMMENT ON TABLE import_finance.import_shipments IS
  'Import shipment ledger — stores inputs and exchange-rate snapshots used for landed-cost calculation.';

-- ---------------------------------------------------------------------------
-- Row Level Security — authenticated read/write
-- ---------------------------------------------------------------------------
ALTER TABLE import_finance.finance_constants ENABLE ROW LEVEL SECURITY;
ALTER TABLE import_finance.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE import_finance.import_shipments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS finance_constants_authenticated_all ON import_finance.finance_constants;
CREATE POLICY finance_constants_authenticated_all
  ON import_finance.finance_constants
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS products_authenticated_all ON import_finance.products;
CREATE POLICY products_authenticated_all
  ON import_finance.products
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS import_shipments_authenticated_all ON import_finance.import_shipments;
CREATE POLICY import_shipments_authenticated_all
  ON import_finance.import_shipments
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- ---------------------------------------------------------------------------
-- Grants (service_role for FastAPI; authenticated for direct Supabase client)
-- ---------------------------------------------------------------------------
GRANT USAGE ON SCHEMA import_finance TO authenticated, anon, service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON import_finance.finance_constants TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON import_finance.products TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON import_finance.import_shipments TO authenticated;

GRANT SELECT ON import_finance.finance_constants TO anon;
GRANT SELECT ON import_finance.products TO anon;
GRANT SELECT ON import_finance.import_shipments TO anon;

GRANT ALL ON ALL TABLES IN SCHEMA import_finance TO service_role;
