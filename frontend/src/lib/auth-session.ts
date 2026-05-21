import { supabase } from "./supabase";
import { isRequestAborted } from "./request-errors";

let accessTokenPromise: Promise<string | null> | null = null;

/**
 * Coalesce concurrent getSession() calls — Supabase aborts overlapping session reads.
 */
export async function getAuthAccessToken(): Promise<string | null> {
  if (!accessTokenPromise) {
    accessTokenPromise = supabase.auth
      .getSession()
      .then(({ data: { session } }) => session?.access_token ?? null)
      .catch((error) => {
        if (isRequestAborted(error)) return null;
        throw error;
      })
      .finally(() => {
        accessTokenPromise = null;
      });
  }
  return accessTokenPromise;
}
