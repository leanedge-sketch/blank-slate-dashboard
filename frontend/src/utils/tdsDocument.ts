/** Resolve TDS PDF URL — prefer final storage path over deleted temp uploads. */
export function resolveTdsDocumentUrl(
  meta: Record<string, unknown> | null | undefined,
): string | null {
  if (!meta || typeof meta !== "object") return null;

  const tdsFileUrl = meta.tds_file_url;
  if (typeof tdsFileUrl === "string" && tdsFileUrl.trim()) {
    return tdsFileUrl.trim();
  }

  const storageKey = meta.tds_file_key;
  if (typeof storageKey === "string" && storageKey.trim()) {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.replace(/\/$/, "");
    if (supabaseUrl) {
      return `${supabaseUrl}/storage/v1/object/public/product-documents/${storageKey.replace(/^\//, "")}`;
    }
  }

  const fileUrl = meta.file_url;
  if (typeof fileUrl === "string" && fileUrl.trim()) {
    const url = fileUrl.trim();
    if (url.includes("/tds_files/temp/") && typeof storageKey === "string") {
      return null;
    }
    return url;
  }

  return null;
}
