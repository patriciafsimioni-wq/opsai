import type { FuelLogDTO } from "./types";
import { formatCurrency, formatDate, formatNumber } from "./utils";

export type FuelPdfOptions = {
  brand: string;
  title: string;
  subtitle: string;
  summary: { label: string; value: string }[];
  rows: FuelLogDTO[];
  typeLabel: Record<string, string>;
  fileName: string;
};

type Col = { header: string; width: number; align?: "right"; value: (l: FuelLogDTO) => string };

/** Render the full fuel transaction list (every row, paged) into a landscape PDF. */
export async function downloadFuelPdf(opts: FuelPdfOptions) {
  const { jsPDF } = await import("jspdf");
  const pdf = new jsPDF({ orientation: "landscape", unit: "pt", format: "letter" });
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const margin = 32;
  const rowH = 16;

  const cols: Col[] = [
    { header: "Date", width: 62, value: (l) => formatDate(l.date) },
    { header: "Vehicle", width: 62, value: (l) => l.vehicle?.name ?? l.vehicleLabel ?? "" },
    { header: "Driver", width: 120, value: (l) => l.driverName || (l.driver ? `${l.driver.firstName} ${l.driver.lastName}` : "") },
    { header: "Type", width: 52, value: (l) => opts.typeLabel[l.purchaseType] ?? l.purchaseType },
    { header: "Station", width: 44, value: (l) => l.station ?? l.vehicle?.station ?? "" },
    { header: "Location", width: 170, value: (l) => l.location ?? "" },
    { header: "Time", width: 48, value: (l) => l.transactionTime ?? "" },
    { header: "Odometer", width: 56, align: "right", value: (l) => (l.odometer != null ? formatNumber(l.odometer) : "") },
    { header: "Gal", width: 46, align: "right", value: (l) => l.liters.toFixed(1) },
    { header: "$/Gal", width: 46, align: "right", value: (l) => formatCurrency(l.pricePerLiter) },
    { header: "Total", width: 56, align: "right", value: (l) => formatCurrency(l.totalCost) },
  ];
  const tableW = cols.reduce((s, c) => s + c.width, 0);
  const x0 = (pageW - tableW) / 2;

  const fit = (text: string, width: number) => {
    let t = text;
    while (t.length > 1 && pdf.getTextWidth(t) > width - 6) t = t.slice(0, -1);
    return t.length < text.length ? t.slice(0, -1) + "…" : t;
  };

  const drawHeader = (y: number) => {
    pdf.setFillColor(241, 245, 249);
    pdf.rect(x0, y, tableW, rowH, "F");
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(7.5);
    pdf.setTextColor(71, 85, 105);
    let x = x0;
    for (const c of cols) {
      const tx = c.align === "right" ? x + c.width - 3 : x + 3;
      pdf.text(c.header.toUpperCase(), tx, y + 11, { align: c.align ?? "left" });
      x += c.width;
    }
    return y + rowH;
  };

  const drawFooter = (page: number, pages: number) => {
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(8);
    pdf.setTextColor(148, 163, 184);
    pdf.text(`${opts.brand} · ${opts.title} · ${opts.subtitle}`, margin, pageH - 14);
    pdf.text(`Page ${page} of ${pages}`, pageW - margin, pageH - 14, { align: "right" });
  };

  // Title block
  let y = margin;
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(16);
  pdf.setTextColor(15, 23, 42);
  pdf.text(opts.title, margin, y + 14);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(9);
  pdf.setTextColor(100, 116, 139);
  pdf.text(opts.subtitle, margin, y + 28);
  pdf.text(`${opts.brand} · Generated ${new Date().toLocaleString("en-US")}`, pageW - margin, y + 14, { align: "right" });
  y += 40;

  // Summary cards
  const cardW = (pageW - margin * 2 - 8 * (opts.summary.length - 1)) / opts.summary.length;
  opts.summary.forEach((s, i) => {
    const cx = margin + i * (cardW + 8);
    pdf.setDrawColor(226, 232, 240);
    pdf.setFillColor(255, 255, 255);
    pdf.roundedRect(cx, y, cardW, 38, 4, 4, "FD");
    pdf.setFontSize(7);
    pdf.setTextColor(100, 116, 139);
    pdf.text(s.label.toUpperCase(), cx + 8, y + 13);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(12);
    pdf.setTextColor(15, 23, 42);
    pdf.text(s.value, cx + 8, y + 29);
    pdf.setFont("helvetica", "normal");
  });
  y += 50;

  // Table
  y = drawHeader(y);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(7.5);
  opts.rows.forEach((l, i) => {
    if (y + rowH > pageH - margin) {
      pdf.addPage();
      y = drawHeader(margin);
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(7.5);
    }
    if (i % 2 === 1) {
      pdf.setFillColor(248, 250, 252);
      pdf.rect(x0, y, tableW, rowH, "F");
    }
    pdf.setTextColor(30, 41, 59);
    let x = x0;
    for (const c of cols) {
      const tx = c.align === "right" ? x + c.width - 3 : x + 3;
      pdf.text(fit(c.value(l), c.width), tx, y + 11, { align: c.align ?? "left" });
      x += c.width;
    }
    y += rowH;
  });
  pdf.setDrawColor(226, 232, 240);
  pdf.line(x0, y, x0 + tableW, y);

  const pages = pdf.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    pdf.setPage(p);
    drawFooter(p, pages);
  }
  pdf.save(opts.fileName);
}
