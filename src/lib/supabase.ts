// src/lib/supabase.ts
// Browser Supabase client for the TanStack Start frontend.
//
// This project talks to an EXTERNALLY MANAGED Supabase project (the same one
// the Streamlit / FastAPI backend uses), not Lovable Cloud. Provide the
// following env vars in `.env` / the Lovable preview secrets:
//
//   VITE_SUPABASE_URL=https://<project>.supabase.co
//   VITE_SUPABASE_PUBLISHABLE_KEY=<anon/publishable key>
//
// VITE_SUPABASE_ANON_KEY is accepted as a fallback for parity with the
// existing `frontend/` Vite app.

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url =
  import.meta.env.VITE_SUPABASE_URL ??
  import.meta.env.SUPABASE_URL ??
  "";

const key =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ??
  import.meta.env.VITE_SUPABASE_ANON_KEY ??
  "";

if (!url || !key) {
  // eslint-disable-next-line no-console
  console.warn(
    "[supabase] Missing VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY — RPC calls will fail until these are set.",
  );
}

export const supabase: SupabaseClient = createClient(url, key, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
  db: { schema: "public" },
});

export const isSupabaseConfigured = Boolean(url && key);
