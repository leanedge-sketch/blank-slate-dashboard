-- Cached Gemini Flash product copy (SEO + technical summary).
-- Paste into Supabase SQL Editor. Safe to re-run.

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS seo_description text,
  ADD COLUMN IF NOT EXISTS technical_summary text;

COMMENT ON COLUMN public.products.seo_description IS
  'Cached Gemini Flash SEO blurb. Generated once; never re-billed while non-null.';
COMMENT ON COLUMN public.products.technical_summary IS
  'Cached Gemini Flash technical summary. Generated once; never re-billed while non-null.';
