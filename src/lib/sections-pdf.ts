export type SectionsPdfOptions = {
  container: HTMLElement;
  title: string;
  subtitle: string;
  fileName: string;
};

/**
 * Render each direct child of `container` to an image and lay them out on
 * letter-size portrait pages, starting a new page whenever a section would not
 * fit, so charts and tables are never cut in half.
 */
export async function downloadSectionsPdf({ container, title, subtitle, fileName }: SectionsPdfOptions) {
  const html2canvas = (await import("html2canvas-pro")).default;
  const { jsPDF } = await import("jspdf");
  const pdf = new jsPDF({ orientation: "portrait", unit: "pt", format: "letter" });
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const margin = 28;
  const gap = 10;
  const contentW = pageW - margin * 2;
  const generated = new Date().toLocaleString();

  const drawHeader = () => {
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(14);
    pdf.setTextColor(15, 23, 42);
    pdf.text(title, margin, margin + 6);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(9);
    pdf.setTextColor(100, 116, 139);
    pdf.text(subtitle, margin, margin + 20);
    pdf.text(`Generated ${generated}`, pageW - margin, margin + 20, { align: "right" });
    pdf.setDrawColor(226, 232, 240);
    pdf.line(margin, margin + 28, pageW - margin, margin + 28);
    return margin + 38;
  };

  let y = drawHeader();
  const sections = Array.from(container.children).filter(
    (el): el is HTMLElement => el instanceof HTMLElement && el.offsetHeight > 0,
  );
  for (const el of sections) {
    const canvas = await html2canvas(el, { scale: 2, useCORS: true, logging: false, backgroundColor: "#ffffff" });
    let w = contentW;
    let h = (canvas.height / canvas.width) * w;
    const maxH = pageH - margin - (margin + 38);
    if (h > maxH) {
      w = (w * maxH) / h;
      h = maxH;
    }
    if (y + h > pageH - margin) {
      pdf.addPage();
      y = drawHeader();
    }
    pdf.addImage(canvas.toDataURL("image/png"), "PNG", margin + (contentW - w) / 2, y, w, h);
    y += h + gap;
  }

  const pages = pdf.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    pdf.setPage(i);
    pdf.setFontSize(8);
    pdf.setTextColor(148, 163, 184);
    pdf.text(`Page ${i} of ${pages}`, pageW - margin, pageH - 14, { align: "right" });
  }
  pdf.save(fileName);
}
