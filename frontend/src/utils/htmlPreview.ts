export function isLikelyHtml(text: string | null | undefined): boolean {
  if (!text) return false;
  return /<\/?[a-z][\s\S]*>/i.test(text);
}

export function stripHtml(html: string | null | undefined): string {
  if (!html) return "";
  return html
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const DANGEROUS_TAGS = /<\/?(?:script|iframe|object|embed|link|meta|form|base|svg|math)[^>]*>/gi;

export function sanitizeInteractionHtml(html: string): string {
  return html
    .replace(DANGEROUS_TAGS, "")
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "")
    .replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/(href|src)\s*=\s*(['"])\s*javascript:[\s\S]*?\2/gi, '$1=$2#$2');
}

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Sanitize AI / rich-text output before innerHTML. Plain text is escaped. */
export function sanitizeAiHtml(input: string): string {
  if (!input) return "";
  if (!isLikelyHtml(input)) {
    return escapeHtml(input).replace(/\n/g, "<br />");
  }
  return sanitizeInteractionHtml(input);
}

