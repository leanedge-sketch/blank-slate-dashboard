import { useEffect, useState } from "react";

import { initSupabase, isSupabaseConfigured } from "@/lib/supabase";

/** Waits for build-time env or runtime API bootstrap before enabling Supabase queries. */
export function useSupabaseReady(): boolean {
  const [ready, setReady] = useState(isSupabaseConfigured());

  useEffect(() => {
    if (ready) return;
    void initSupabase().then((ok) => setReady(ok));
  }, [ready]);

  return ready;
}
