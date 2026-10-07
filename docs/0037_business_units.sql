-- Mirror of migrations/011_business_units.sql (repo docs numbering).
-- Paste into Supabase SQL Editor.

CREATE TABLE IF NOT EXISTS public.business_units (
  name text PRIMARY KEY,
  is_system boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.business_units (name, is_system) VALUES
  ('Hayat', true),
  ('Alhadi', true),
  ('Bet-chem', true),
  ('Barracoda', true),
  ('Nyumb-Chem', true),
  ('Synresins', true)
ON CONFLICT (name) DO NOTHING;

CREATE OR REPLACE FUNCTION public.sales_pipeline_business_unit_valid(p_unit text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  IF p_unit IS NULL OR btrim(p_unit) = '' THEN
    RETURN TRUE;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.business_units bu
    WHERE lower(btrim(bu.name)) = lower(btrim(p_unit))
  ) THEN
    RETURN TRUE;
  END IF;

  IF btrim(p_unit) IN (
    'Hayat',
    'Alhadi',
    'Bet-chem',
    'Barracoda',
    'Nyumb-Chem',
    'Synresins'
  ) THEN
    RETURN TRUE;
  END IF;

  RETURN FALSE;
END;
$$;

ALTER TABLE public.sales_pipeline
DROP CONSTRAINT IF EXISTS sales_pipeline_business_unit_check;

ALTER TABLE public.sales_pipeline
ADD CONSTRAINT sales_pipeline_business_unit_check
CHECK (public.sales_pipeline_business_unit_valid(business_unit)) NOT VALID;

ALTER TABLE public.sales_pipeline
VALIDATE CONSTRAINT sales_pipeline_business_unit_check;

ALTER TABLE public.business_units ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS business_units_select ON public.business_units;
CREATE POLICY business_units_select ON public.business_units
  FOR SELECT TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS business_units_insert ON public.business_units;
CREATE POLICY business_units_insert ON public.business_units
  FOR INSERT TO anon, authenticated
  WITH CHECK (true);

GRANT SELECT, INSERT ON public.business_units TO anon, authenticated, service_role;
