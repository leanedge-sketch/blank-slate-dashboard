-- Backfill uuid_id on existing Chemical_Master_Data rows (run after 0005).
-- Required for TDS and Sales pipeline chemical type pickers.

UPDATE public."Chemical_Master_Data"
SET uuid_id = gen_random_uuid()
WHERE uuid_id IS NULL;
