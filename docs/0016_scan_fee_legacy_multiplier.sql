-- Legacy official assessment: scan fee is labelled 0.07% but uses multiplier 0.007 on CIF.
-- Run after 0013b if finance_constants was seeded with 0.0007.

UPDATE public.finance_constants
SET scan_fee_pct = 0.007
WHERE scan_fee_pct = 0.0007;

ALTER TABLE public.finance_constants
  ALTER COLUMN scan_fee_pct SET DEFAULT 0.007;
