-- Current price/cost columns on Chemical_Master_Data (synced from Pricing & Costing).
-- Skip any column you already added manually in Supabase.

ALTER TABLE public."Chemical_Master_Data"
  ADD COLUMN IF NOT EXISTS "Current_Price" numeric;

ALTER TABLE public."Chemical_Master_Data"
  ADD COLUMN IF NOT EXISTS "Current_Price_Currency" text;

ALTER TABLE public."Chemical_Master_Data"
  ADD COLUMN IF NOT EXISTS "Current_Cost" numeric;

ALTER TABLE public."Chemical_Master_Data"
  ADD COLUMN IF NOT EXISTS "Current_Cost_Currency" text;

COMMENT ON COLUMN public."Chemical_Master_Data"."Current_Price" IS
  'Latest active sell price from PMS Pricing & Costing.';

COMMENT ON COLUMN public."Chemical_Master_Data"."Current_Cost" IS
  'Latest active cost from PMS Pricing & Costing.';
