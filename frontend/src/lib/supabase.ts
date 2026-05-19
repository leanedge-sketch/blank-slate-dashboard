import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getApiBaseUrl } from "./api-base";

let supabaseUrl = import.meta.env.VITE_SUPABASE_URL ?? "";
let supabaseAnonKey =
  import.meta.env.VITE_SUPABASE_ANON_KEY ??
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ??
  "";

let _client: SupabaseClient | null = null;
let _bootstrapPromise: Promise<boolean> | null = null;

export function isSupabaseConfigured(): boolean {
  return Boolean(supabaseUrl && supabaseAnonKey);
}

/**
 * Load Supabase URL + anon key at runtime from the FastAPI backend when Vite
 * did not bake them in (common on Vercel if only server-side SUPABASE_* vars are set).
 */
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
        console.error(
          "[supabase] Runtime bootstrap failed:",
          res.status,
          await res.text(),
        );
        return false;
      }
      const data = (await res.json()) as { url?: string; anon_key?: string };
      if (data.url && data.anon_key) {
        supabaseUrl = data.url;
        supabaseAnonKey = data.anon_key;
        _client = null;
        console.log("[supabase] Loaded config from API at runtime");
        return true;
      }
    } catch (err) {
      console.error("[supabase] Runtime bootstrap error:", err);
    }
    return false;
  })();

  return _bootstrapPromise;
}

/** Call once before rendering the app (see main.tsx). */
export async function initSupabase(): Promise<boolean> {
  const ok = isSupabaseConfigured() || (await bootstrapSupabase());
  if (!ok) {
    console.error(
      "[supabase] Not configured. Set on Vercel:\n" +
        "  Frontend build: VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY\n" +
        "  Backend runtime: SUPABASE_URL, SUPABASE_KEY, SUPABASE_SERVICE_KEY\n" +
        "Then redeploy.",
    );
  }
  return ok;
}

export function getSupabase(): SupabaseClient {
  if (!isSupabaseConfigured()) {
    throw new Error(
      "Supabase is not configured. Set VITE_SUPABASE_* or SUPABASE_* server env vars on Vercel, then redeploy.",
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
