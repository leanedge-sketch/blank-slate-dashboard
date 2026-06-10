/** User-edited description takes precedence over AI-generated text. */
export function getTdsProductDescription(
  meta: Record<string, unknown> | null | undefined,
): string {
  if (!meta || typeof meta !== "object") return "";
  const user = meta.product_description;
  if (typeof user === "string" && user.trim()) return user.trim();
  const ai = meta.ai_product_description;
  if (typeof ai === "string" && ai.trim()) return ai.trim();
  return "";
}
