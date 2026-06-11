-- Grants for Chemical_Master_Data (required when RLS is on or anon cannot read).
-- Run in Supabase SQL editor alongside docs/0005_chemical_master_data_extend.sql.

GRANT SELECT ON public."Chemical_Master_Data" TO authenticated;
GRANT SELECT ON public."Chemical_Master_Data" TO anon;
GRANT ALL ON public."Chemical_Master_Data" TO service_role;
