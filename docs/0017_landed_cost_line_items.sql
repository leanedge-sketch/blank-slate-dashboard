-- Stage 3 landed-cost line items for legacy Excel parity.
-- Run in Supabase SQL Editor after 0015_trade_shipment_ledger.sql.

ALTER TABLE public.trade_shipment_ledger
  ADD COLUMN IF NOT EXISTS bank_charge_pct_on_capital numeric NOT NULL DEFAULT 0.078,
  ADD COLUMN IF NOT EXISTS insurance_etb numeric NOT NULL DEFAULT 1000,
  ADD COLUMN IF NOT EXISTS betchem_clearance_etb numeric NOT NULL DEFAULT 13500,
  ADD COLUMN IF NOT EXISTS profit_tax_pct_on_pre_landed numeric NOT NULL DEFAULT 0.044553057;

COMMENT ON COLUMN public.trade_shipment_ledger.bank_charge_pct_on_capital IS
  'Bank charges = capital outlay × this rate (legacy default 7.8%).';
COMMENT ON COLUMN public.trade_shipment_ledger.insurance_etb IS
  'Transit insurance flat ETB.';
COMMENT ON COLUMN public.trade_shipment_ledger.betchem_clearance_etb IS
  'Betchem clearance flat ETB.';
COMMENT ON COLUMN public.trade_shipment_ledger.profit_tax_pct_on_pre_landed IS
  'Profit tax = pre-landed base × this rate (before profit tax line).';
