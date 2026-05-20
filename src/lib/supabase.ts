// Browser Supabase client for the TanStack app (Lovable / Vercel / local).
// Set in Lovable Secrets or repo-root `.env`:
//   VITE_SUPABASE_URL
//   VITE_SUPABASE_PUBLISHABLE_KEY  (or VITE_SUPABASE_ANON_KEY)

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { getApiBaseUrl } from "./api-base";

let supabaseUrl =
  import.meta.env.VITE_SUPABASE_URL ??
  import.meta.env.SUPABASE_URL ??
  "";

let supabaseAnonKey =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ??
  import.meta.env.VITE_SUPABASE_ANON_KEY ??
  import.meta.env.SUPABASE_KEY ??
  "";

let _client: SupabaseClient | null = null;
let _bootstrapPromise: Promise<boolean> | null = null;

export function isSupabaseConfigured(): boolean {
  return Boolean(supabaseUrl && supabaseAnonKey);
}

if (!isSupabaseConfigured()) {
  console.warn(
    "[supabase] Missing VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY. " +
      "Add them in Lovable → Settings → Secrets (or root .env), then rebuild.",
  );
}

export async function bootstrapSupabase(): Promise<boolean> {
  if (isSupabaseConfigured()) {
    return true;
  }
  if (_bootstrapPromise) {
    return _bootstrapPromise;
  }

  _bootstrapPromise = (async () => {
    try {
      const res = await fetch(`${getApiBaseUrl()}/auth/public-config`);
      if (!res.ok) {
        return false;
      }
      const data = (await res.json()) as { url?: string; anon_key?: string };
      if (data.url && data.anon_key) {
        supabaseUrl = data.url;
        supabaseAnonKey = data.anon_key;
        _client = null;
        console.log("[supabase] Loaded config from API");
        return true;
      }
    } catch {
      // Lovable-only preview — secrets must be set at build time.
    }
    return false;
  })();

  return _bootstrapPromise;
}

export async function initSupabase(): Promise<boolean> {
  return isSupabaseConfigured() || (await bootstrapSupabase());
}

function getSupabase(): SupabaseClient {
  if (!isSupabaseConfigured()) {
    throw new Error(
      "Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY in Lovable Secrets.",
    );
  }
  if (!_client) {
    _client = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
      db: { schema: "public" },
    });
  }
  return _client;
}

export const supabase: SupabaseClient = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    const client = getSupabase();
    const value = Reflect.get(client, prop, client) as unknown;
    return typeof value === "function"
      ? (value as (...args: unknown[]) => unknown).bind(client)
      : value;
  },
});
