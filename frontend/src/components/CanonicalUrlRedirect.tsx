import { useEffect } from "react";
import { getCanonicalRedirectUrl } from "../lib/canonical-host";

/**
 * Sends users on old Vercel aliases to the canonical production URL.
 */
export function CanonicalUrlRedirect() {
  useEffect(() => {
    const target = getCanonicalRedirectUrl();
    if (target) {
      window.location.replace(target);
    }
  }, []);

  const redirecting = getCanonicalRedirectUrl() !== null;
  if (!redirecting) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 99999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#0f172a",
        color: "#e2e8f0",
        fontFamily: "system-ui, sans-serif",
      }}
    >
      Redirecting to the current app URL…
    </div>
  );
}
