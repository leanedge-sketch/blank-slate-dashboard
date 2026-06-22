-- Link Trade & Transit shipment lines to PMS chemical master catalog.
ALTER TABLE public.import_finance_shipments
  ADD COLUMN IF NOT EXISTS chemical_type_id text;

COMMENT ON COLUMN public.import_finance_shipments.chemical_type_id IS
  'PMS chemical_full_data uuid_id (or integer id) for the selected catalog product.';

CREATE INDEX IF NOT EXISTS import_finance_shipments_chemical_type_idx
  ON public.import_finance_shipments (chemical_type_id)
  WHERE chemical_type_id IS NOT NULL;
