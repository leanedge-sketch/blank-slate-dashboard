-- Extend Chemical_Master_Data for full product records + pipeline uuid links.
-- Run in Supabase SQL editor before migrating data from chemical_full_data.

ALTER TABLE public."Chemical_Master_Data"
  ADD COLUMN IF NOT EXISTS "Industry" text,
  ADD COLUMN IF NOT EXISTS "Price" numeric,
  ADD COLUMN IF NOT EXISTS "Typical_Application" text,
  ADD COLUMN IF NOT EXISTS "Product_Description" text,
  ADD COLUMN IF NOT EXISTS "Partner_ID" uuid,
  ADD COLUMN IF NOT EXISTS uuid_id uuid DEFAULT gen_random_uuid();

CREATE UNIQUE INDEX IF NOT EXISTS chemical_master_data_uuid_id_idx
  ON public."Chemical_Master_Data" (uuid_id)
  WHERE uuid_id IS NOT NULL;

-- Optional: allow authenticated app users to read/write (adjust role as needed).
-- ALTER TABLE public."Chemical_Master_Data" ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY "Allow authenticated read" ON public."Chemical_Master_Data"
--   FOR SELECT TO authenticated USING (true);
-- CREATE POLICY "Allow authenticated write" ON public."Chemical_Master_Data"
--   FOR ALL TO authenticated USING (true) WITH CHECK (true);
