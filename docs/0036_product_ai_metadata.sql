-- Mirror of migrations/010_product_ai_metadata.sql
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS seo_description text,
  ADD COLUMN IF NOT EXISTS technical_summary text;
