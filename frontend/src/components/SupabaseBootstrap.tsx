import { useEffect, useState } from "react";
import { initSupabase, isSupabaseConfigured } from "../lib/supabase";

export function SupabaseBootstrap({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(isSupabaseConfigured());
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (ready) return;
    initSupabase().then((ok) => {
      setReady(ok);
      setFailed(!ok);
    });
  }, [ready]);

  if (!ready && !failed) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-400">
        Connecting to Supabase…
      </div>
    );
  }

  if (failed) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 text-slate-300">
        <div className="max-w-lg text-sm space-y-2">
          <p className="text-amber-400 font-medium">Could not connect to Supabase</p>
          <p>
            Add server env vars on Vercel: <code>SUPABASE_URL</code>,{" "}
            <code>SUPABASE_KEY</code>, <code>SUPABASE_SERVICE_KEY</code>, then redeploy.
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
