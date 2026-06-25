-- Contact person on import finance shipments (CRM primary contact or manual entry).
ALTER TABLE public.import_finance_shipments
  ADD COLUMN IF NOT EXISTS contact_person text;

COMMENT ON COLUMN public.import_finance_shipments.contact_person IS
  'Buyer contact for this shipment request — from CRM primary_contact_name or manual entry.';
