-- Supplier link + optional apply policy metadata on pricing rows.
-- Run after docs/0010b_pricing_sync_columns.sql

ALTER TABLE public.pricing_records
  ADD COLUMN IF NOT EXISTS supplier_partner_id uuid;

COMMENT ON COLUMN public.pricing_records.supplier_partner_id IS
  'PMS partner_data id for the supplier on this buyer↔product price row.';

CREATE INDEX IF NOT EXISTS pricing_records_supplier_idx
  ON public.pricing_records (supplier_partner_id);
