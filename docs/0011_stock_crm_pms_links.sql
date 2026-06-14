-- Link stock ledger to CRM deals and PMS catalog (shared uuid_id spine).
-- Run in Supabase SQL editor.

ALTER TABLE public.stock_movements
  ADD COLUMN IF NOT EXISTS pipeline_id uuid;

ALTER TABLE public.stock_movements
  ADD COLUMN IF NOT EXISTS catalog_uuid_id uuid;

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS catalog_uuid_id uuid;

CREATE INDEX IF NOT EXISTS stock_movements_pipeline_idx
  ON public.stock_movements (pipeline_id);

CREATE INDEX IF NOT EXISTS stock_movements_catalog_uuid_idx
  ON public.stock_movements (catalog_uuid_id);

CREATE INDEX IF NOT EXISTS stock_movements_customer_idx
  ON public.stock_movements (customer_id);

CREATE INDEX IF NOT EXISTS products_catalog_uuid_idx
  ON public.products (catalog_uuid_id);

COMMENT ON COLUMN public.stock_movements.pipeline_id IS
  'CRM sales_pipeline deal this movement fulfills (optional).';

COMMENT ON COLUMN public.stock_movements.catalog_uuid_id IS
  'PMS Chemical_Master_Data uuid_id for the product (optional).';

COMMENT ON COLUMN public.products.catalog_uuid_id IS
  'PMS catalog uuid_id — one stock product label per catalog item when set.';
