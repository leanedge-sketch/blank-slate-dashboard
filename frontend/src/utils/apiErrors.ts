/** Turn FastAPI / axios error payloads into a user-readable string. */
export function formatApiErrorDetail(
  err: unknown,
  fallback = "Something went wrong.",
): string {
  if (!err || typeof err !== "object") {
    return fallback;
  }

  const response = (err as { response?: { data?: { detail?: unknown } } }).response;
  const detail = response?.data?.detail;

  if (typeof detail === "string" && detail.trim()) {
    return detail;
  }

  if (Array.isArray(detail)) {
    const messages = detail
      .map((item) => {
        if (typeof item === "string") return item;
        if (item && typeof item === "object" && "msg" in item) {
          const msg = (item as { msg?: string }).msg;
          const loc = (item as { loc?: unknown[] }).loc;
          if (msg && Array.isArray(loc) && loc.length) {
            return `${loc.slice(-1).join(".")}: ${msg}`;
          }
          return msg ?? null;
        }
        return null;
      })
      .filter(Boolean);
    if (messages.length) return messages.join("; ");
  }

  if (detail && typeof detail === "object" && "msg" in detail) {
    const msg = (detail as { msg?: string }).msg;
    if (msg) return msg;
  }

  const message = (err as { message?: string }).message;
  if (message) return message;

  return fallback;
}
