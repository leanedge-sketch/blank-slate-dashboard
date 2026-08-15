/**
 * Loop A public-site Supabase client (shared with leanchemweb RFQ inbox).
 * Prefer NEXT_PUBLIC_* (requested) then VITE_* aliases.
 * Keep separate from the CRM Supabase project when they differ.
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

function readLoopAEnv(): { url: string; key: string } {
  const env = import.meta.env as Record<string, string | undefined>;
  const url =
    env.NEXT_PUBLIC_SUPABASE_URL ||
    env.VITE_LOOP_A_SUPABASE_URL ||
    "";
  const key =
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    env.VITE_LOOP_A_SUPABASE_ANON_KEY ||
    "";
  return { url, key };
}

let _client: SupabaseClient | null = null;

export function isLoopASupabaseConfigured(): boolean {
  const { url, key } = readLoopAEnv();
  return Boolean(url && key);
}

export function getLoopASupabase(): SupabaseClient {
  const { url, key } = readLoopAEnv();
  if (!url || !key) {
    throw new Error(
      "Loop A Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY (shared public-site backend).",
    );
  }
  if (!_client) {
    _client = createClient(url, key, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
      db: { schema: "public" },
      realtime: { params: { eventsPerSecond: 10 } },
    });
  }
  return _client;
}

export const loopASupabase: SupabaseClient = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    const client = getLoopASupabase();
    const value = Reflect.get(client, prop, client) as unknown;
    return typeof value === "function"
      ? (value as (...args: unknown[]) => unknown).bind(client)
      : value;
  },
});
