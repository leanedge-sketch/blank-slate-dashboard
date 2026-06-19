-- Import Finance: persist full 4-stage pipeline snapshot on each shipment row.
-- Run in Supabase SQL Editor after 0013b.
--
-- Adds input snapshots + Stage 1–4 calculated outputs to import_finance_shipments
-- so every field visible in the UI appears in Table Editor.

ALTER TABLE public.import_finance_shipments
  ADD COLUMN IF NOT EXISTS snapshot_base_customs_reference_usd numeric,
  ADD COLUMN IF NOT EXISTS target_selling_price_etb_per_kg numeric,
  ADD COLUMN IF NOT EXISTS material_cost_usd_per_kg numeric,
  ADD COLUMN IF NOT EXISTS border_value_usd_per_kg numeric,
  ADD COLUMN IF NOT EXISTS capital_outlay_etb numeric,
  ADD COLUMN IF NOT EXISTS cif_assessed_usd_per_kg numeric,
  ADD COLUMN IF NOT EXISTS cif_base_etb numeric,
  ADD COLUMN IF NOT EXISTS duty_etb numeric,
  ADD COLUMN IF NOT EXISTS scan_fee_etb numeric,
  ADD COLUMN IF NOT EXISTS social_fee_etb numeric,
  ADD COLUMN IF NOT EXISTS wht_etb numeric,
  ADD COLUMN IF NOT EXISTS vat_etb numeric,
  ADD COLUMN IF NOT EXISTS total_customs_paid_etb numeric,
  ADD COLUMN IF NOT EXISTS inland_transport_etb numeric,
  ADD COLUMN IF NOT EXISTS gross_investment_etb numeric,
  ADD COLUMN IF NOT EXISTS net_landed_cost_etb numeric,
  ADD COLUMN IF NOT EXISTS final_landed_unit_cost_etb_per_kg numeric,
  ADD COLUMN IF NOT EXISTS profit_per_kg_etb numeric,
  ADD COLUMN IF NOT EXISTS gross_margin_pct numeric,
  ADD COLUMN IF NOT EXISTS total_expected_revenue_etb numeric;

COMMENT ON COLUMN public.import_finance_shipments.snapshot_base_customs_reference_usd IS
  'Base customs reference USD/kg at time of save (Stage 2 input).';
COMMENT ON COLUMN public.import_finance_shipments.target_selling_price_etb_per_kg IS
  'Target selling price ETB/kg for margin outlook (Stage 4 input).';
COMMENT ON COLUMN public.import_finance_shipments.capital_outlay_etb IS
  'Stage 1 — capital deployed at Moyale border (parallel FX).';
COMMENT ON COLUMN public.import_finance_shipments.total_customs_paid_etb IS
  'Stage 2 — sum of duty, scan, social, WHT, and VAT.';
COMMENT ON COLUMN public.import_finance_shipments.final_landed_unit_cost_etb_per_kg IS
  'Stage 3 — net landed unit cost in Addis Ababa warehouse.';
COMMENT ON COLUMN public.import_finance_shipments.gross_margin_pct IS
  'Stage 4 — gross margin % vs target selling price.';
