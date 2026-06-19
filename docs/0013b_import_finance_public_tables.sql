-- Import Finance: public tables for Supabase Table Editor + app API.
-- Run in SQL Editor AFTER docs/0013_import_finance.sql (or standalone on a fresh DB).
--
-- Table Editor only lists the `public` schema reliably. These tables mirror
-- import_finance.* and copy any existing rows across.

-- ---------------------------------------------------------------------------
-- 1. finance_constants
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.finance_constants (
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

COMMENT ON TABLE public.finance_constants IS
  'Import finance tax rates — single row, editable in Table Editor.';

INSERT INTO public.finance_constants (singleton)
VALUES (true)
ON CONFLICT (singleton) DO NOTHING;

-- Copy from import_finance schema if you ran the older migration
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'import_finance' AND table_name = 'finance_constants'
  ) THEN
    INSERT INTO public.finance_constants (
      id, singleton, customs_duty_pct, scan_fee_pct, social_fee_pct,
      wht_pct, vat_pct, freight_insurance_buffer_pct, updated_at
    )
    SELECT
      id, singleton, customs_duty_pct, scan_fee_pct, social_fee_pct,
      wht_pct, vat_pct, freight_insurance_buffer_pct, updated_at
    FROM import_finance.finance_constants
    ON CONFLICT (singleton) DO NOTHING;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 2. import_finance_products (not public.products — Stock uses that name)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.import_finance_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_name text NOT NULL,
  base_customs_reference_usd numeric NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS import_finance_products_name_idx
  ON public.import_finance_products (product_name);

COMMENT ON TABLE public.import_finance_products IS
  'Import finance product master — visible in Table Editor under public.';

INSERT INTO public.import_finance_products (id, product_name, base_customs_reference_usd, created_at)
SELECT '00000000-0000-0000-0000-000000000001'::uuid, 'Sodium Gluconate', 0.792, now()
WHERE NOT EXISTS (
  SELECT 1 FROM public.import_finance_products WHERE product_name = 'Sodium Gluconate'
);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'import_finance' AND table_name = 'products'
  ) THEN
    INSERT INTO public.import_finance_products (id, product_name, base_customs_reference_usd, created_at)
    SELECT id, product_name, base_customs_reference_usd, created_at
    FROM import_finance.products
    ON CONFLICT (id) DO NOTHING;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 3. import_finance_shipments
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.import_finance_shipments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.import_finance_products (id) ON DELETE RESTRICT,
  quantity_kg numeric NOT NULL CHECK (quantity_kg > 0),
  supplier_base_price_usd numeric NOT NULL,
  supplier_margin_pct numeric NOT NULL DEFAULT 0,
  transport_to_border_usd numeric NOT NULL,
  snapshot_official_rate numeric NOT NULL,
  snapshot_parallel_rate numeric NOT NULL,
  local_clearance_per_kg_etb numeric NOT NULL DEFAULT 20,
  status text NOT NULL DEFAULT 'draft',
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT import_finance_shipments_status_check CHECK (
    status IN ('draft', 'submitted', 'cleared', 'cancelled')
  )
);

CREATE INDEX IF NOT EXISTS import_finance_shipments_product_idx
  ON public.import_finance_shipments (product_id);

CREATE INDEX IF NOT EXISTS import_finance_shipments_created_idx
  ON public.import_finance_shipments (created_at DESC);

COMMENT ON TABLE public.import_finance_shipments IS
  'Import shipment ledger — visible in Table Editor under public.';

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'import_finance' AND table_name = 'import_shipments'
  ) THEN
    INSERT INTO public.import_finance_shipments (
      id, product_id, quantity_kg, supplier_base_price_usd, supplier_margin_pct,
      transport_to_border_usd, snapshot_official_rate, snapshot_parallel_rate,
      local_clearance_per_kg_etb, status, created_at
    )
    SELECT
      id, product_id, quantity_kg, supplier_base_price_usd, supplier_margin_pct,
      transport_to_border_usd, snapshot_official_rate, snapshot_parallel_rate,
      local_clearance_per_kg_etb, status, created_at
    FROM import_finance.import_shipments
    ON CONFLICT (id) DO NOTHING;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- RLS (public schema — no extra API schema exposure needed)
-- ---------------------------------------------------------------------------
ALTER TABLE public.finance_constants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.import_finance_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.import_finance_shipments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS finance_constants_authenticated_all ON public.finance_constants;
CREATE POLICY finance_constants_authenticated_all
  ON public.finance_constants FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS import_finance_products_authenticated_all ON public.import_finance_products;
CREATE POLICY import_finance_products_authenticated_all
  ON public.import_finance_products FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS import_finance_shipments_authenticated_all ON public.import_finance_shipments;
CREATE POLICY import_finance_shipments_authenticated_all
  ON public.import_finance_shipments FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.finance_constants TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.import_finance_products TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.import_finance_shipments TO authenticated;

GRANT SELECT ON public.finance_constants TO anon;
GRANT SELECT ON public.import_finance_products TO anon;
GRANT SELECT ON public.import_finance_shipments TO anon;

GRANT ALL ON public.finance_constants TO service_role;
GRANT ALL ON public.import_finance_products TO service_role;
GRANT ALL ON public.import_finance_shipments TO service_role;
