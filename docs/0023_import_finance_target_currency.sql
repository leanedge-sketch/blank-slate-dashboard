-- Snapshot customer quote currency on each saved pipeline line (Stage 4 FX deck).
ALTER TABLE public.import_finance_shipments
  ADD COLUMN IF NOT EXISTS snapshot_target_currency text;

COMMENT ON COLUMN public.import_finance_shipments.snapshot_target_currency IS
  'Customer quote currency at save time (USD or ETB) — drives Stage 4 FX reporting.';
