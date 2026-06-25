-- Request date on import finance shipments (pipeline entry date).
ALTER TABLE public.import_finance_shipments
  ADD COLUMN IF NOT EXISTS request_date date;

COMMENT ON COLUMN public.import_finance_shipments.request_date IS
  'Date the customer import / pipeline request was raised (distinct from created_at).';
