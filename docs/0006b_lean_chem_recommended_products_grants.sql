-- Run if the table already exists but API calls fail with permission errors.
-- Safe to re-run.

GRANT SELECT, INSERT, UPDATE, DELETE ON public."LeanChem_Recommended_Products" TO authenticated;
GRANT SELECT ON public."LeanChem_Recommended_Products" TO anon;
GRANT ALL ON public."LeanChem_Recommended_Products" TO service_role;
