-- Add Industry column to LeanChem_Recommended_Products (separate from Product_Type).
-- Run once in Supabase SQL editor after docs/0006_lean_chem_recommended_products.sql.

ALTER TABLE public."LeanChem_Recommended_Products"
  ADD COLUMN IF NOT EXISTS "Industry" text;
