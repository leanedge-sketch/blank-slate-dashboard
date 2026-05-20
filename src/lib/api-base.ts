/** FastAPI base URL (local uvicorn, Vercel `/api`, or Lovable preview). */
export function getApiBaseUrl(): string {
  const fromEnv = import.meta.env.VITE_API_URL?.trim();
  if (fromEnv) {
    return fromEnv.replace(/\/$/, "");
  }
  if (import.meta.env.PROD && typeof window !== "undefined") {
    if (window.location.hostname.endsWith(".vercel.app")) {
      return `${window.location.origin}/api/v1`;
    }
  }
  return "http://localhost:8000/api/v1";
}
