import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";
import type { CognitiveSummary } from "./executiveReportTypes";

export type PdfExportMode = "full" | "textOnly";

export async function exportExecutiveReportPdf(
  root: HTMLElement,
  summary: CognitiveSummary,
  meta: { title: string; rangeLabel: string; entityLabel: string },
  mode: PdfExportMode,
): Promise<void> {
  const stamp = new Date().toISOString().slice(0, 10);
  const filename = `executive-report-${stamp}.pdf`;

  if (mode === "textOnly") {
    const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
    const margin = 48;
    let y = margin;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.text(meta.title, margin, y);
    y += 22;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`${meta.rangeLabel} · ${meta.entityLabel}`, margin, y);
    y += 28;

    doc.setTextColor(0);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text(summary.headline, margin, y);
    y += 20;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    for (const bullet of summary.bullets) {
      const lines = doc.splitTextToSize(`• ${bullet}`, 500);
      doc.text(lines, margin, y);
      y += lines.length * 14 + 8;
    }

    doc.save(filename);
    return;
  }

  const canvas = await html2canvas(root, {
    backgroundColor: "#020617",
    scale: 2,
    useCORS: true,
    logging: false,
  });

  const imgData = canvas.toDataURL("image/png");
  const pdf = new jsPDF({
    orientation: canvas.width > canvas.height ? "landscape" : "portrait",
    unit: "px",
    format: [canvas.width, canvas.height],
  });

  pdf.addImage(imgData, "PNG", 0, 0, canvas.width, canvas.height);
  pdf.save(filename);
}
