-- Group Trade & Transit saves by client request (optional — run when persisting multi-product).
ALTER TABLE public.import_finance_shipments
  ADD COLUMN IF NOT EXISTS client_name text,
  ADD COLUMN IF NOT EXISTS request_ref text;

COMMENT ON COLUMN public.import_finance_shipments.client_name IS
  'Buyer / customer for this pipeline line (multiple lines may share one client).';
COMMENT ON COLUMN public.import_finance_shipments.request_ref IS
  'Optional PO or quote reference shared across products on one request.';
