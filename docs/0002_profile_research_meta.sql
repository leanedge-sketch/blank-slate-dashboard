-- Optional: stores counts/chars for RAG, CRM, web, and LinkedIn used in the last profile build.
ALTER TABLE public.customers
ADD COLUMN IF NOT EXISTS latest_profile_research_meta jsonb;
