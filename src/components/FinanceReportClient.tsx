"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useData } from "@/lib/use-data";
import { SlidePresentation } from "./SlidePresentation";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const STATION_ORDER = ["ALL", "IAH", "AUS", "HRL", "LRD", "ACT", "CLL", "BPT"];

type CategoryRow = {
  category: string;
  actualPrev: number;
  actualCurrent: number;
  yoyVariancePct: number | null;
  yoyVarianceAmt: number;
  budget: number;
  budgetVariancePct: number | null;
  budgetVarianceAmt: number;
  ytdPrev: number;
  ytdCurrent: number;
  ytdVarianceAmt: number;
  ytdBudget: number;
  ytdBudgetVariancePct: number | null;
  ytdBudgetVarianceAmt: number;
  annualBudget: number;
  remainderAmt: number;
  remainderPct: number | null;
};

type StationBlock = {
  rows: CategoryRow[];
  label: string;
};

type MonthlyTotal = {
  month: number;
  actual: number;
  prevYear: number;
  budget: number;
};

type ReportData = {
  year: number;
  month: number;
  prevYear: number;
  reportType: string;
  stations: Record<string, StationBlock>;
  monthlyTotals: MonthlyTotal[];
  monthlyByStation: Record<string, MonthlyTotal[]>;
  weekStart?: string;
  weekEnd?: string;
};

function fmt(n: number): string {
  if (n === 0) return "-";
  return "$" + Math.abs(n).toLocaleString("en-US");
}

function fmtSigned(n: number): string {
  if (n === 0) return "-";
  const prefix = n > 0 ? "" : "-";
  return prefix + "$" + Math.abs(n).toLocaleString("en-US");
}

function fmtPct(n: number | null): string {
  if (n === null) return "-";
  return n + "%";
}

function budgetVarianceColor(amt: number): string {
  if (amt < 0) return "text-green-700";
  if (amt > 0) return "text-red-600";
  return "";
}

function VarianceTable({ station, data, year, month, serviceLabel = "PM Service" }: { station: string; data: StationBlock; year: number; month: number; serviceLabel?: string }) {
  const prevYear = year - 1;
  const rows = data.rows;
  const totals = {
    actualPrev: rows.reduce((s, r) => s + r.actualPrev, 0),
    actualCurrent: rows.reduce((s, r) => s + r.actualCurrent, 0),
    budget: rows.reduce((s, r) => s + r.budget, 0),
    yoyVarianceAmt: rows.reduce((s, r) => s + r.yoyVarianceAmt, 0),
    budgetVarianceAmt: rows.reduce((s, r) => s + r.budgetVarianceAmt, 0),
    ytdPrev: rows.reduce((s, r) => s + r.ytdPrev, 0),
    ytdCurrent: rows.reduce((s, r) => s + r.ytdCurrent, 0),
    ytdVarianceAmt: rows.reduce((s, r) => s + r.ytdVarianceAmt, 0),
    ytdBudget: rows.reduce((s, r) => s + r.ytdBudget, 0),
    ytdBudgetVarianceAmt: rows.reduce((s, r) => s + r.ytdBudgetVarianceAmt, 0),
    annualBudget: rows.reduce((s, r) => s + r.annualBudget, 0),
    remainderAmt: rows.reduce((s, r) => s + r.remainderAmt, 0),
  };
  const totalYtdBudPct = totals.ytdBudget > 0 ? Math.round(((totals.ytdCurrent - totals.ytdBudget) / totals.ytdBudget) * 100) : null;
  const totalRemPct = totals.annualBudget > 0 ? Math.round((totals.remainderAmt / totals.annualBudget) * 100) : null;

  const isConsolidated = station === "ALL";
  const headerBg = isConsolidated ? "bg-blue-50" : "bg-slate-50";
  const titleBg = isConsolidated ? "bg-blue-600 text-white" : "bg-slate-700 text-white";

  return (
    <div className="mb-8 overflow-x-auto rounded-xl border border-[var(--color-border)] shadow-sm">
      <table className="w-full text-xs">
        <thead>
          <tr className={titleBg}>
            <th colSpan={6} className="px-3 py-2 text-left text-sm font-bold">
              {MONTHS[month - 1]} {year} — {data.label}
            </th>
            <th colSpan={5} className="px-3 py-2 text-left text-sm font-bold">Year to Date Results</th>
            <th colSpan={3} className="px-3 py-2 text-left text-sm font-bold">Remainder Balance</th>
          </tr>
          <tr className={headerBg + " border-b border-[var(--color-border)]"}>
            <th className="whitespace-nowrap px-2 py-1.5 text-left font-semibold">#</th>
            <th className="whitespace-nowrap px-2 py-1.5 text-left font-semibold">{serviceLabel}</th>
            <th className="whitespace-nowrap px-2 py-1.5 text-right font-semibold">A{prevYear}</th>
            <th className="whitespace-nowrap px-2 py-1.5 text-right font-semibold">A{year}</th>
            <th className="whitespace-nowrap px-2 py-1.5 text-right font-semibold">B{year}</th>
            <th className="whitespace-nowrap px-2 py-1.5 text-right font-semibold">A-B Var</th>
            <th className="whitespace-nowrap px-2 py-1.5 text-right font-semibold">A{prevYear}</th>
            <th className="whitespace-nowrap px-2 py-1.5 text-right font-semibold">A{year}</th>
            <th className="whitespace-nowrap px-2 py-1.5 text-right font-semibold">B{year}</th>
            <th className="whitespace-nowrap px-2 py-1.5 text-right font-semibold">A-B Var%</th>
            <th className="whitespace-nowrap px-2 py-1.5 text-right font-semibold">A-B Var$</th>
            <th className="whitespace-nowrap px-2 py-1.5 text-right font-semibold">Annual B{year}</th>
            <th className="whitespace-nowrap px-2 py-1.5 text-right font-semibold">Bal. Left</th>
            <th className="whitespace-nowrap px-2 py-1.5 text-right font-semibold">Bal. %</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.category} className={i % 2 === 0 ? "bg-white" : "bg-slate-50/50"}>
              <td className="px-2 py-1.5 text-slate-400">{i + 1}</td>
              <td className="whitespace-nowrap px-2 py-1.5 font-medium">{r.category}</td>
              <td className="px-2 py-1.5 text-right tabular-nums">{fmt(r.actualPrev)}</td>
              <td className="px-2 py-1.5 text-right tabular-nums font-medium">{fmt(r.actualCurrent)}</td>
              <td className="px-2 py-1.5 text-right tabular-nums text-slate-500">{fmt(r.budget)}</td>
              <td className={`px-2 py-1.5 text-right tabular-nums font-medium ${budgetVarianceColor(r.budgetVarianceAmt)}`}>
                {fmtSigned(r.budgetVarianceAmt)}
              </td>
              <td className="px-2 py-1.5 text-right tabular-nums">{fmt(r.ytdPrev)}</td>
              <td className="px-2 py-1.5 text-right tabular-nums font-medium">{fmt(r.ytdCurrent)}</td>
              <td className="px-2 py-1.5 text-right tabular-nums text-slate-500">{fmt(r.ytdBudget)}</td>
              <td className={`px-2 py-1.5 text-right tabular-nums ${budgetVarianceColor(r.ytdBudgetVarianceAmt)}`}>
                {fmtPct(r.ytdBudgetVariancePct)}
              </td>
              <td className={`px-2 py-1.5 text-right tabular-nums font-medium ${budgetVarianceColor(r.ytdBudgetVarianceAmt)}`}>
                {fmtSigned(r.ytdBudgetVarianceAmt)}
              </td>
              <td className="px-2 py-1.5 text-right tabular-nums text-slate-500">{fmt(r.annualBudget)}</td>
              <td className="px-2 py-1.5 text-right tabular-nums font-medium">{fmt(r.remainderAmt)}</td>
              <td className="px-2 py-1.5 text-right tabular-nums">{fmtPct(r.remainderPct)}</td>
            </tr>
          ))}
          <tr className="border-t-2 border-slate-300 bg-slate-100 font-bold">
            <td className="px-2 py-2"></td>
            <td className="px-2 py-2">TOTAL</td>
            <td className="px-2 py-2 text-right tabular-nums">{fmt(totals.actualPrev)}</td>
            <td className="px-2 py-2 text-right tabular-nums">{fmt(totals.actualCurrent)}</td>
            <td className="px-2 py-2 text-right tabular-nums">{fmt(totals.budget)}</td>
            <td className={`px-2 py-2 text-right tabular-nums ${budgetVarianceColor(totals.budgetVarianceAmt)}`}>
              {fmtSigned(totals.budgetVarianceAmt)}
            </td>
            <td className="px-2 py-2 text-right tabular-nums">{fmt(totals.ytdPrev)}</td>
            <td className="px-2 py-2 text-right tabular-nums">{fmt(totals.ytdCurrent)}</td>
            <td className="px-2 py-2 text-right tabular-nums">{fmt(totals.ytdBudget)}</td>
            <td className={`px-2 py-2 text-right tabular-nums ${budgetVarianceColor(totals.ytdBudgetVarianceAmt)}`}>
              {fmtPct(totalYtdBudPct)}
            </td>
            <td className={`px-2 py-2 text-right tabular-nums ${budgetVarianceColor(totals.ytdBudgetVarianceAmt)}`}>
              {fmtSigned(totals.ytdBudgetVarianceAmt)}
            </td>
            <td className="px-2 py-2 text-right tabular-nums">{fmt(totals.annualBudget)}</td>
            <td className="px-2 py-2 text-right tabular-nums">{fmt(totals.remainderAmt)}</td>
            <td className="px-2 py-2 text-right tabular-nums">{fmtPct(totalRemPct)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function BarChart({ data, year }: { data: MonthlyTotal[]; year: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const prevYear = year - 1;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.scale(dpr, dpr);

    const pad = { top: 40, right: 20, bottom: 40, left: 70 };
    const chartW = w - pad.left - pad.right;
    const chartH = h - pad.top - pad.bottom;
    const maxVal = Math.max(...data.map((d) => Math.max(d.actual, d.prevYear, d.budget)), 1) * 1.15;

    ctx.clearRect(0, 0, w, h);

    // Grid lines
    ctx.strokeStyle = "#e2e8f0";
    ctx.lineWidth = 0.5;
    for (let i = 0; i <= 5; i++) {
      const y = pad.top + (chartH / 5) * i;
      ctx.beginPath();
      ctx.moveTo(pad.left, y);
      ctx.lineTo(w - pad.right, y);
      ctx.stroke();
      ctx.fillStyle = "#94a3b8";
      ctx.font = "10px system-ui";
      ctx.textAlign = "right";
      const val = Math.round(maxVal - (maxVal / 5) * i);
      ctx.fillText("$" + val.toLocaleString(), pad.left - 8, y + 3);
    }

    const barGroupW = chartW / 12;
    const barW = barGroupW * 0.25;
    const gap = barGroupW * 0.05;

    data.forEach((d, i) => {
      const x = pad.left + barGroupW * i + barGroupW * 0.1;

      // Prev year bar
      const h1 = (d.prevYear / maxVal) * chartH;
      ctx.fillStyle = "#93c5fd";
      ctx.fillRect(x, pad.top + chartH - h1, barW, h1);

      // Current year bar
      const h2 = (d.actual / maxVal) * chartH;
      ctx.fillStyle = "#3b82f6";
      ctx.fillRect(x + barW + gap, pad.top + chartH - h2, barW, h2);

      // Budget bar
      const h3 = (d.budget / maxVal) * chartH;
      ctx.fillStyle = "#f97316";
      ctx.fillRect(x + (barW + gap) * 2, pad.top + chartH - h3, barW, h3);

      // Month label
      ctx.fillStyle = "#475569";
      ctx.font = "10px system-ui";
      ctx.textAlign = "center";
      ctx.fillText(MONTHS[d.month - 1], pad.left + barGroupW * i + barGroupW / 2, pad.top + chartH + 16);
    });

    // Legend
    const legendX = pad.left + 10;
    const legendY = 12;
    const items = [
      { color: "#93c5fd", label: `A${prevYear}` },
      { color: "#3b82f6", label: `A${year}` },
      { color: "#f97316", label: `B${year}` },
    ];
    items.forEach((item, i) => {
      ctx.fillStyle = item.color;
      ctx.fillRect(legendX + i * 80, legendY, 12, 12);
      ctx.fillStyle = "#334155";
      ctx.font = "11px system-ui";
      ctx.textAlign = "left";
      ctx.fillText(item.label, legendX + i * 80 + 16, legendY + 10);
    });

    // Title
    ctx.fillStyle = "#1e293b";
    ctx.font = "bold 13px system-ui";
    ctx.textAlign = "center";
    ctx.fillText(`${year} Actual vs Budget | PM Expenses Monthly`, w / 2, 12 + 10);
  }, [data, year, prevYear]);

  return <canvas ref={canvasRef} className="h-[340px] w-full" />;
}

function YtdChart({ data, year }: { data: MonthlyTotal[]; year: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const prevYear = year - 1;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.scale(dpr, dpr);

    const pad = { top: 40, right: 20, bottom: 40, left: 70 };
    const chartW = w - pad.left - pad.right;
    const chartH = h - pad.top - pad.bottom;

    // Compute cumulative values
    const cumActual: number[] = [];
    const cumPrev: number[] = [];
    const cumBudget: number[] = [];
    let sa = 0, sp = 0, sb = 0;
    data.forEach((d) => {
      sa += d.actual; sp += d.prevYear; sb += d.budget;
      cumActual.push(sa); cumPrev.push(sp); cumBudget.push(sb);
    });

    const maxVal = Math.max(...cumActual, ...cumPrev, ...cumBudget, 1) * 1.15;

    ctx.clearRect(0, 0, w, h);

    // Grid
    ctx.strokeStyle = "#e2e8f0";
    ctx.lineWidth = 0.5;
    for (let i = 0; i <= 5; i++) {
      const y = pad.top + (chartH / 5) * i;
      ctx.beginPath();
      ctx.moveTo(pad.left, y);
      ctx.lineTo(w - pad.right, y);
      ctx.stroke();
      ctx.fillStyle = "#94a3b8";
      ctx.font = "10px system-ui";
      ctx.textAlign = "right";
      const val = Math.round(maxVal - (maxVal / 5) * i);
      ctx.fillText("$" + val.toLocaleString(), pad.left - 8, y + 3);
    }

    const barGroupW = chartW / 12;
    const barW = barGroupW * 0.25;
    const gap2 = barGroupW * 0.05;

    data.forEach((_, i) => {
      const x = pad.left + barGroupW * i + barGroupW * 0.1;

      const h1 = (cumPrev[i] / maxVal) * chartH;
      ctx.fillStyle = "#93c5fd";
      ctx.fillRect(x, pad.top + chartH - h1, barW, h1);

      const h2 = (cumActual[i] / maxVal) * chartH;
      ctx.fillStyle = "#3b82f6";
      ctx.fillRect(x + barW + gap2, pad.top + chartH - h2, barW, h2);

      const h3 = (cumBudget[i] / maxVal) * chartH;
      ctx.fillStyle = "#f97316";
      ctx.fillRect(x + (barW + gap2) * 2, pad.top + chartH - h3, barW, h3);

      ctx.fillStyle = "#475569";
      ctx.font = "10px system-ui";
      ctx.textAlign = "center";
      ctx.fillText(MONTHS[i], pad.left + barGroupW * i + barGroupW / 2, pad.top + chartH + 16);
    });

    // Legend
    const legendX = pad.left + 10;
    const legendY = 12;
    [
      { color: "#93c5fd", label: `A${prevYear} YTD` },
      { color: "#3b82f6", label: `A${year} YTD` },
      { color: "#f97316", label: `B${year} YTD` },
    ].forEach((item, i) => {
      ctx.fillStyle = item.color;
      ctx.fillRect(legendX + i * 100, legendY, 12, 12);
      ctx.fillStyle = "#334155";
      ctx.font = "11px system-ui";
      ctx.textAlign = "left";
      ctx.fillText(item.label, legendX + i * 100 + 16, legendY + 10);
    });

    ctx.fillStyle = "#1e293b";
    ctx.font = "bold 13px system-ui";
    ctx.textAlign = "center";
    ctx.fillText(`${year} YTD Actual vs Budget | PM Expenses Cumulative`, w / 2, 12 + 10);
  }, [data, year, prevYear]);

  return <canvas ref={canvasRef} className="h-[340px] w-full" />;
}

function getMonday(d: Date): Date {
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(d.getFullYear(), d.getMonth(), diff);
}

export function FinanceReportClient() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [viewMode, setViewMode] = useState<"week" | "month">("month");
  const [weekDate, setWeekDate] = useState(now.toISOString().slice(0, 10));
  const [reportType, setReportType] = useState<"PM" | "CR">("PM");
  const weekParam = viewMode === "week" ? `&view=week&weekDate=${weekDate}` : "";
  const { data, loading } = useData<ReportData>(`/api/finance-report?year=${year}&month=${month}${weekParam}&reportType=${reportType}`);
  const [activeStation, setActiveStation] = useState("ALL");
  const [chartStation, setChartStation] = useState("ALL");
  const [exporting, setExporting] = useState(false);
  const [showSlides, setShowSlides] = useState(false);
  const reportRef = useRef<HTMLDivElement>(null);

  const handleExportPDF = useCallback(async () => {
    if (!reportRef.current) return;
    setExporting(true);
    try {
      const html2canvas = (await import("html2canvas-pro")).default;
      const { jsPDF } = await import("jspdf");
      const el = reportRef.current;
      const canvas = await html2canvas(el, { scale: 2, useCORS: true, logging: false });
      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF({ orientation: "landscape", unit: "px", format: [canvas.width, canvas.height] });
      pdf.addImage(imgData, "PNG", 0, 0, canvas.width, canvas.height);
      const label = reportType === "CR" ? "Corrective_Repairs" : "PM";
      pdf.save(`${label}_Finance_Report_${MONTHS[month - 1]}_${year}.pdf`);
    } catch {
      window.print();
    } finally {
      setExporting(false);
    }
  }, [reportType, month, year]);

  if (loading) return <div className="p-8 text-center text-slate-500">Loading report...</div>;
  if (!data) return <div className="p-8 text-center text-red-500">Failed to load report data.</div>;

  const allStation = data.stations["ALL"];
  const totalYtdActual = allStation?.rows.reduce((s, r) => s + r.ytdCurrent, 0) ?? 0;
  const totalYtdBudget = allStation?.rows.reduce((s, r) => s + r.ytdBudget, 0) ?? 0;
  const totalAnnualBudget = allStation?.rows.reduce((s, r) => s + r.annualBudget, 0) ?? 0;
  const totalRemainder = totalAnnualBudget - totalYtdActual;
  const budgetUtilPct = totalAnnualBudget > 0 ? Math.round((totalYtdActual / totalAnnualBudget) * 100) : 0;

  const reportLabel = reportType === "CR" ? "Corrective Repairs" : "Preventive Maintenance";

  return (
    <div className="space-y-6 print:space-y-4">
      {/* Header controls */}
      <div className="flex flex-wrap items-center gap-4 print:hidden">
        {/* Report type toggle */}
        <div className="flex rounded-lg border border-[var(--color-border)] overflow-hidden">
          <button
            onClick={() => setReportType("PM")}
            className={`px-3 py-1.5 text-sm font-medium transition-colors ${
              reportType === "PM"
                ? "bg-blue-600 text-white"
                : "bg-white text-slate-600 hover:bg-slate-50"
            }`}
          >
            PM Finance
          </button>
          <button
            onClick={() => setReportType("CR")}
            className={`px-3 py-1.5 text-sm font-medium transition-colors ${
              reportType === "CR"
                ? "bg-blue-600 text-white"
                : "bg-white text-slate-600 hover:bg-slate-50"
            }`}
          >
            Corrective Repairs
          </button>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-slate-600">Year</label>
          <select
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-sm"
          >
            {[2025, 2026, 2027].map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>

        {/* Week/Month toggle */}
        <div className="flex rounded-lg border border-[var(--color-border)] overflow-hidden">
          <button
            onClick={() => setViewMode("week")}
            className={`px-3 py-1.5 text-sm font-medium transition-colors ${
              viewMode === "week"
                ? "bg-blue-600 text-white"
                : "bg-white text-slate-600 hover:bg-slate-50"
            }`}
          >
            Week
          </button>
          <button
            onClick={() => setViewMode("month")}
            className={`px-3 py-1.5 text-sm font-medium transition-colors ${
              viewMode === "month"
                ? "bg-blue-600 text-white"
                : "bg-white text-slate-600 hover:bg-slate-50"
            }`}
          >
            Month
          </button>
        </div>

        {viewMode === "month" ? (
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-slate-600">Month</label>
            <select
              value={month}
              onChange={(e) => setMonth(Number(e.target.value))}
              className="rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-sm"
            >
              {MONTHS.map((m, i) => (
                <option key={i} value={i + 1}>{m}</option>
              ))}
            </select>
          </div>
        ) : (
          <div className="flex items-center gap-1">
            <button
              onClick={() => {
                const d = new Date(weekDate);
                d.setDate(d.getDate() - 7);
                setWeekDate(d.toISOString().slice(0, 10));
              }}
              className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
            </button>
            <span className="min-w-[180px] text-center text-sm font-medium text-slate-700">
              {data?.weekStart && data?.weekEnd
                ? `${new Date(data.weekStart).toLocaleDateString("en-US", { month: "short", day: "numeric" })} – ${new Date(data.weekEnd).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`
                : "Loading..."}
            </span>
            <button
              onClick={() => {
                const d = new Date(weekDate);
                d.setDate(d.getDate() + 7);
                setWeekDate(d.toISOString().slice(0, 10));
              }}
              className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
            </button>
          </div>
        )}

        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={() => setShowSlides(true)}
            className="rounded-lg bg-indigo-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-indigo-700"
          >
            Generate Slides
          </button>
          <button
            onClick={handleExportPDF}
            disabled={exporting}
            className="rounded-lg bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {exporting ? "Preparing..." : "Export PDF"}
          </button>
        </div>
      </div>

      <div ref={reportRef}>
      {/* Report title for print */}
      <div className="hidden print:block">
        <h1 className="text-xl font-bold">SYNCTX / Fleet {reportLabel} Expenses</h1>
        <p className="text-sm text-slate-600">Year: {year} | Month: {MONTHS[month - 1]} | Actual to Budget Variance Analysis</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="rounded-xl border border-[var(--color-border)] bg-white p-4">
          <p className="text-xs font-medium text-slate-500">YTD Actual Spend</p>
          <p className="mt-1 text-xl font-bold text-slate-900">${totalYtdActual.toLocaleString()}</p>
        </div>
        <div className="rounded-xl border border-[var(--color-border)] bg-white p-4">
          <p className="text-xs font-medium text-slate-500">YTD Budget</p>
          <p className="mt-1 text-xl font-bold text-slate-900">${totalYtdBudget.toLocaleString()}</p>
        </div>
        <div className="rounded-xl border border-[var(--color-border)] bg-white p-4">
          <p className="text-xs font-medium text-slate-500">Annual Budget</p>
          <p className="mt-1 text-xl font-bold text-slate-900">${totalAnnualBudget.toLocaleString()}</p>
        </div>
        <div className="rounded-xl border border-[var(--color-border)] bg-white p-4">
          <p className="text-xs font-medium text-slate-500">Remainder ({100 - budgetUtilPct}% left)</p>
          <p className="mt-1 text-xl font-bold text-green-700">${totalRemainder.toLocaleString()}</p>
        </div>
      </div>

      {/* Charts */}
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-slate-600">Chart Station</span>
          <select
            value={chartStation}
            onChange={(e) => setChartStation(e.target.value)}
            className="rounded-lg border border-[var(--color-border)] bg-white px-3 py-1.5 text-sm"
          >
            {STATION_ORDER.map((s) => (
              <option key={s} value={s}>{s === "ALL" ? "All Stations" : s}</option>
            ))}
          </select>
        </div>
        <div className="rounded-xl border border-[var(--color-border)] bg-white p-6">
          <BarChart data={data.monthlyByStation?.[chartStation] ?? data.monthlyTotals} year={year} />
        </div>
        <div className="rounded-xl border border-[var(--color-border)] bg-white p-6">
          <YtdChart data={data.monthlyByStation?.[chartStation] ?? data.monthlyTotals} year={year} />
        </div>
      </div>

      {/* Station tabs */}
      <div className="flex gap-1 overflow-x-auto print:hidden">
        {STATION_ORDER.map((s) => {
          const label = s === "ALL" ? "Consolidated TX" : s;
          return (
            <button
              key={s}
              onClick={() => setActiveStation(s)}
              className={`whitespace-nowrap rounded-lg px-4 py-1.5 text-sm font-medium transition-colors ${
                activeStation === s
                  ? "bg-blue-600 text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {label}
            </button>
          );
        })}
      </div>

      {/* Active station table (screen) */}
      <div className="print:hidden">
        {data.stations[activeStation] && (
          <VarianceTable
            station={activeStation}
            data={data.stations[activeStation]}
            year={year}
            month={month}
            serviceLabel={reportType === "CR" ? "CR Service" : "PM Service"}
          />
        )}
      </div>

      {/* All stations for print */}
      <div className="hidden print:block">
        {STATION_ORDER.map((s) =>
          data.stations[s] ? (
            <VarianceTable key={s} station={s} data={data.stations[s]} year={year} month={month} serviceLabel={reportType === "CR" ? "CR Service" : "PM Service"} />
          ) : null,
        )}
      </div>
      </div>{/* close reportRef */}

      {showSlides && (
        <SlidePresentation
          year={year}
          month={month}
          reportType={reportType}
          onClose={() => setShowSlides(false)}
        />
      )}
    </div>
  );
}
