-- Pricing junction: partner kind + CRM pricing snapshot for outward sync.
-- Run in Supabase SQL editor after docs/0010_pricing_junction.sql.

ALTER TABLE public.pricing_records
  ADD COLUMN IF NOT EXISTS partner_kind text NOT NULL DEFAULT 'crm'
    CHECK (partner_kind IN ('crm', 'pms'));

ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS latest_pricing_summary jsonb DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.pricing_records.partner_kind IS
  'crm = CRM customer (buyer); pms = PMS partner_data (supplier/logistics).';

COMMENT ON COLUMN public.customers.latest_pricing_summary IS
  'Latest active sell/cost snapshot keyed by PMS product id — updated from Pricing & Costing.';
