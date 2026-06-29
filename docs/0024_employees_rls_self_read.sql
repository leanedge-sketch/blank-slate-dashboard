-- Employees table access: allow signed-in users to read their own row
-- (used when the API falls back to a direct Supabase lookup after login).

CREATE TABLE IF NOT EXISTS public.employees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  name text,
  role text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS employees_select_own ON public.employees;
CREATE POLICY employees_select_own ON public.employees
  FOR SELECT
  TO authenticated
  USING (lower(trim(email)) = lower(trim(auth.jwt() ->> 'email')));

GRANT SELECT ON public.employees TO authenticated;

-- Seed / repair common accounts (safe upsert)
INSERT INTO public.employees (email, name, role)
VALUES
  ('alhadi@leanchems.com', 'Alhadi', 'admin')
ON CONFLICT (email) DO UPDATE
SET role = EXCLUDED.role, name = COALESCE(EXCLUDED.name, public.employees.name);

COMMENT ON POLICY employees_select_own ON public.employees IS
  'Lets signed-in users verify their own employee row for app access checks.';
