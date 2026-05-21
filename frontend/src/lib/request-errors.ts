/** True when a fetch/axios call was cancelled (navigation, auth race, StrictMode). */
export function isRequestAborted(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const e = error as { name?: string; code?: string; message?: string };
  if (e.name === "AbortError" || e.code === "ERR_CANCELED") return true;
  const msg = typeof e.message === "string" ? e.message.toLowerCase() : "";
  return msg.includes("abort") || msg.includes("canceled");
}
