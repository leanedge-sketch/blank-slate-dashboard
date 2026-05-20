/** Canonical production app (Vercel). */
export const PRODUCTION_APP_URL = "https://blank-slate-dashboard-plum.vercel.app";

/** FastAPI on Vercel — do not use Render in production. */
export const VERCEL_API_BASE = `${PRODUCTION_APP_URL}/api/v1`;

function isRenderUrl(url: string): boolean {
  return url.includes("onrender.com");
}

/** API base URL for the FastAPI backend (Vercel `/api` or local uvicorn). */
export function getApiBaseUrl(): string {
  const fromEnv = import.meta.env.VITE_API_URL?.trim();

  // Ignore Render URLs — production uses Vercel serverless only.
  if (fromEnv && !isRenderUrl(fromEnv)) {
    return fromEnv.replace(/\/$/, "");
  }

  if (import.meta.env.PROD) {
    if (typeof window !== "undefined") {
      if (window.location.hostname.endsWith(".vercel.app")) {
        return `${window.location.origin}/api/v1`;
      }
    }
    return VERCEL_API_BASE;
  }

  return "http://localhost:8000/api/v1";
}
