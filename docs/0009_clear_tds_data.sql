-- Clear all TDS master data rows (keeps tds_data table and columns for future use).
-- Run once in Supabase SQL Editor when you want an empty TDS catalog.

DELETE FROM public.tds_data;
