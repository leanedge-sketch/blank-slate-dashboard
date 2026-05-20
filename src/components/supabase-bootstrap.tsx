import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

import { initSupabase, isSupabaseConfigured } from "@/lib/supabase";
import { isMockAuthEnabled } from "@/lib/mock-auth";

export function SupabaseBootstrap({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(isSupabaseConfigured() || isMockAuthEnabled);

  useEffect(() => {
    if (ready) return;
    void initSupabase().then(setReady);
  }, [ready]);

  if (!ready && !isMockAuthEnabled) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin mr-2" />
        Connecting to Supabase…
      </div>
    );
  }

  return <>{children}</>;
}
