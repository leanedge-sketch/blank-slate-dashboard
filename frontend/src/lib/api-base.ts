/** API base URL for the FastAPI backend (Vercel `/api` or local uvicorn). */
export function getApiBaseUrl(): string {
  if (import.meta.env.PROD && typeof window !== "undefined") {
    // Same-origin API when deployed on Vercel (ignore stale Render VITE_API_URL).
    if (window.location.hostname.endsWith(".vercel.app")) {
      return `${window.location.origin}/api/v1`;
    }
  }

  const fromEnv = import.meta.env.VITE_API_URL?.trim();
  if (fromEnv) {
    return fromEnv.replace(/\/$/, "");
  }

  if (import.meta.env.PROD && typeof window !== "undefined") {
    return `${window.location.origin}/api/v1`;
  }

  return "http://localhost:8000/api/v1";
}
