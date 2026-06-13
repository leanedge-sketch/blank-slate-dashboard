-- CRM ↔ PMS pricing junction (time-series rows + reusable locations).
-- Run once in Supabase SQL editor.

CREATE TABLE IF NOT EXISTS public.pricing_locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  country text NOT NULL,
  city text,
  port text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS pricing_locations_country_idx
  ON public.pricing_locations (country);

CREATE TABLE IF NOT EXISTS public.pricing_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  crm_partner_id uuid NOT NULL,
  pms_product_id text NOT NULL,
  incoterm text NOT NULL,
  location_id uuid NOT NULL REFERENCES public.pricing_locations (id),
  cost_currency text NOT NULL,
  cost_amount numeric NOT NULL,
  price_currency text NOT NULL,
  price_amount numeric NOT NULL,
  needs_currency_conversion boolean NOT NULL DEFAULT false,
  exchange_rate_used numeric,
  base_currency text,
  valid_from date NOT NULL,
  valid_to date,
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'historical', 'draft')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS pricing_records_partner_idx
  ON public.pricing_records (crm_partner_id);

CREATE INDEX IF NOT EXISTS pricing_records_partner_status_idx
  ON public.pricing_records (crm_partner_id, status);

CREATE INDEX IF NOT EXISTS pricing_records_location_idx
  ON public.pricing_records (location_id);

COMMENT ON TABLE public.pricing_locations IS
  'Reusable country / city / port options for PMS pricing & costing.';

COMMENT ON TABLE public.pricing_records IS
  'Append-only CRM partner ↔ PMS product pricing with validity windows.';

-- Seed common East Africa locations (skip if already present).
INSERT INTO public.pricing_locations (country, city, port)
SELECT v.country, v.city, v.port
FROM (VALUES
  ('Kenya', 'Mombasa', 'Port of Mombasa'),
  ('Kenya', 'Nairobi', NULL),
  ('Ethiopia', 'Addis Ababa', NULL)
) AS v(country, city, port)
WHERE NOT EXISTS (
  SELECT 1 FROM public.pricing_locations pl
  WHERE pl.country = v.country
    AND COALESCE(pl.city, '') = COALESCE(v.city, '')
    AND COALESCE(pl.port, '') = COALESCE(v.port, '')
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pricing_locations TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pricing_records TO authenticated;
GRANT SELECT ON public.pricing_locations TO anon;
GRANT SELECT ON public.pricing_records TO anon;
GRANT ALL ON public.pricing_locations TO service_role;
GRANT ALL ON public.pricing_records TO service_role;
