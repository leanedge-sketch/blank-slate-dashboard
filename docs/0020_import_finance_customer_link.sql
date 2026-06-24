-- Link import finance shipments to CRM customers (in addition to client_name text).
ALTER TABLE public.import_finance_shipments
  ADD COLUMN IF NOT EXISTS customer_id uuid REFERENCES public.customers(customer_id);

CREATE INDEX IF NOT EXISTS import_finance_shipments_customer_idx
  ON public.import_finance_shipments (customer_id);

COMMENT ON COLUMN public.import_finance_shipments.customer_id IS
  'CRM customers.customer_id — preferred link over fuzzy client_name matching.';
