import { jsPDF } from "jspdf";

export interface TdsProductBrief {
  productName?: string | null;
  brand?: string | null;
  grade?: string | null;
  supplier?: string | null;
  description?: string | null;
}

function safeFilenamePart(value: string): string {
  return (
    value
      .trim()
      .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "-")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 80) || "product"
  );
}

function triggerBlobDownload(blob: Blob, filename: string): void {
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 0);
}

/** Supabase storage honours ?download=<name> by sending Content-Disposition. */
function openStorageDownload(url: string, filename?: string | null): void {
  let href = url;
  try {
    const target = new URL(url, window.location.href);
    target.searchParams.set("download", filename?.trim() || "");
    href = target.toString();
  } catch {
    /* Non-absolute URL — use it as-is. */
  }
  const anchor = document.createElement("a");
  anchor.href = href;
  anchor.target = "_blank";
  anchor.rel = "noopener noreferrer";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
}

export async function downloadOriginalTds(
  url: string,
  originalFilename?: string | null,
): Promise<void> {
  let response: Response;
  try {
    response = await fetch(url);
  } catch {
    // Storage host blocked the cross-origin read — let the browser fetch it directly.
    openStorageDownload(url, originalFilename);
    return;
  }

  if (!response.ok) {
    throw new Error(`Original file download failed (${response.status}).`);
  }

  const blob = await response.blob();
  const fallbackExtension = blob.type === "application/pdf" ? ".pdf" : "";
  const filename =
    originalFilename?.trim() || `original-tds${fallbackExtension}`;
  triggerBlobDownload(blob, filename);
}

export function downloadTdsProductBrief(brief: TdsProductBrief): void {
  const productLabel =
    brief.productName?.trim() || brief.brand?.trim() || "Product";
  const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 52;
  const contentWidth = pageWidth - margin * 2;
  let y = 58;

  doc.setTextColor(5, 150, 105);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("LEANCHEM", margin, y);

  y += 34;
  doc.setTextColor(15, 23, 42);
  doc.setFontSize(22);
  doc.text("Product Brief", margin, y);

  y += 27;
  doc.setFontSize(16);
  doc.text(productLabel, margin, y);

  const details = [
    ["Brand", brief.brand],
    ["Grade", brief.grade],
    ["Supplier", brief.supplier],
  ].filter((entry): entry is [string, string] => Boolean(entry[1]?.trim()));

  if (details.length > 0) {
    y += 28;
    doc.setFontSize(10);
    for (const [label, value] of details) {
      doc.setFont("helvetica", "bold");
      doc.setTextColor(71, 85, 105);
      doc.text(`${label}:`, margin, y);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(15, 23, 42);
      doc.text(value, margin + 62, y);
      y += 18;
    }
  }

  y += 16;
  doc.setDrawColor(203, 213, 225);
  doc.line(margin, y, pageWidth - margin, y);
  y += 28;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(15, 23, 42);
  doc.text("Product overview", margin, y);
  y += 20;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10.5);
  doc.setTextColor(51, 65, 85);
  const description =
    brief.description?.trim() ||
    "Please contact LeanChem for product details and recommended applications.";
  const lines = doc.splitTextToSize(description, contentWidth);
  doc.text(lines, margin, y, { lineHeightFactor: 1.45 });

  doc.setFontSize(8.5);
  doc.setTextColor(100, 116, 139);
  doc.text(
    "This brief is for general product information. Refer to the original technical data sheet for specifications.",
    margin,
    doc.internal.pageSize.getHeight() - 42,
    { maxWidth: contentWidth },
  );

  doc.save(`${safeFilenamePart(productLabel)}-product-brief.pdf`);
}
