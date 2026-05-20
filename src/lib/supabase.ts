// Lazy browser Supabase client for the TanStack frontend.
// The external Supabase project's URL/anon key are provided via Vite env vars
// (VITE_SUPABASE_URL + VITE_SUPABASE_PUBLISHABLE_KEY). If they are missing
// at module-load time we must NOT throw — that blanks the entire app. Instead
// we defer createClient() until the first call and surface a clear error.

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url =
  (import.meta.env.VITE_SUPABASE_URL as string | undefined) ??
  (import.meta.env.SUPABASE_URL as string | undefined) ??
  "";

const key =
  (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined) ??
  (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) ??
  "";

export const isSupabaseConfigured = Boolean(url && key);

if (!isSupabaseConfigured) {
  // eslint-disable-next-line no-console
  console.warn(
    "[supabase] Missing VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY — " +
      "auth and DB calls will fail until these are set in .env and the dev server is restarted.",
  );
}

let _client: SupabaseClient | null = null;

function getClient(): SupabaseClient {
  if (_client) return _client;
  if (!isSupabaseConfigured) {
    throw new Error(
      "Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY in .env, then restart the dev server.",
    );
  }
  _client = createClient(url, key, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
    db: { schema: "public" },
  });
  return _client;
}

// Proxy so existing `import { supabase }` call sites keep working without
// triggering createClient() at module evaluation time.
export const supabase: SupabaseClient = new Proxy({} as SupabaseClient, {
  get(_t, prop) {
    const c = getClient();
    const v = Reflect.get(c, prop, c) as unknown;
    return typeof v === "function" ? (v as (...a: unknown[]) => unknown).bind(c) : v;
  },
});
