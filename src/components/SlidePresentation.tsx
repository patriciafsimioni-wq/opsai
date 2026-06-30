"use client";

import { useState, useRef } from "react";
import { useData } from "@/lib/use-data";

type CoverSlide = {
  type: "cover";
  title: string;
  subtitle: string;
  bullets: string[];
  footer: string;
};

type StationCard = {
  station: string;
  label: string;
  prevYearExpenses: number;
  currentYearExpenses: number;
  annualBudget: number;
  ytdVariancePct: number;
  ytdVarianceAmt: number;
  remainingBalance: number;
};

type ExecSummarySlide = {
  type: "executive_summary";
  title: string;
  sections: { heading: string; paragraphs: string[] }[];
  stationBullets: string[];
  stationCards: StationCard[];
};

type DetailedSlide = {
  type: "detailed_analysis";
  title: string;
  heading: string;
  overallMonthly: {
    prevYearExpenses: number;
    currentYearExpenses: number;
    yoyVariancePct: number;
    yoyVarianceAmt: number;
    budget: number;
    budgetVariancePct: number;
    budgetVarianceAmt: number;
  };
  stationFindings: {
    station: string;
    label: string;
    actual: number;
    budget: number;
    variancePct: number;
    varianceAmt: number;
    finding: string;
  }[];
};

type YtdSlide = {
  type: "ytd_summary";
  title: string;
  heading: string;
  stats: {
    prevYearExpenses: number;
    currentYearExpenses: number;
    yoyVariancePct: number;
    yoyVarianceAmt: number;
    annualBudget: number;
    ytdBudgetVariancePct: number;
    ytdBudgetVarianceAmt: number;
    remainingBalance: number;
  };
  observations: string[];
};

type CategoryDetailSlide = {
  type: "category_detail";
  title: string;
  heading: string;
  monthName: string;
  year: number;
  prevYear: number;
  categories: {
    category: string;
    monthActual: number;
    monthPrev: number;
    monthBudget: number;
    yoyPct: number;
    yoyAmt: number;
    budgetVariancePct: number;
    budgetVarianceAmt: number;
    stationConcentration: { station: string; monthActual: number }[];
  }[];
};

type Slide = CoverSlide | ExecSummarySlide | DetailedSlide | CategoryDetailSlide | YtdSlide;

type SlidesData = {
  year: number;
  month: number;
  monthName: string;
  reportType: string;
  reportLabel: string;
  slides: Slide[];
};

function fmtDollar(n: number): string {
  return "$" + Math.abs(n).toLocaleString("en-US");
}

function CoverSlideView({ slide }: { slide: CoverSlide }) {
  return (
    <div className="flex h-full flex-col justify-between bg-gradient-to-br from-blue-900 via-blue-800 to-blue-700 p-12 text-white">
      <div>
        <div className="mb-2 text-sm font-medium uppercase tracking-widest text-blue-200">SYNCTX Fleet Operations</div>
        <h1 className="text-3xl font-bold leading-tight">{slide.title}</h1>
        <p className="mt-3 text-xl font-medium text-blue-100">{slide.subtitle}</p>
      </div>
      <div className="space-y-2">
        {slide.bullets.map((b, i) => (
          <div key={i} className="flex items-center gap-2 text-sm text-blue-100">
            <span className="text-blue-300">{i === 0 ? "§" : "•"}</span> {b}
          </div>
        ))}
      </div>
      <p className="text-xs text-blue-300">{slide.footer}</p>
    </div>
  );
}

function ExecSummarySlideView({ slide }: { slide: ExecSummarySlide }) {
  return (
    <div className="flex h-full flex-col bg-white p-10">
      <h2 className="mb-4 border-b-2 border-blue-600 pb-2 text-2xl font-bold text-blue-900">{slide.title}</h2>
      <div className="flex-1 space-y-4 overflow-y-auto">
        {/* Station YTD cards */}
        {slide.stationCards.length > 0 && (
          <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
            {slide.stationCards.map((sc) => (
              <div key={sc.station} className="rounded-lg border border-slate-200 bg-slate-50 p-2.5">
                <p className="mb-1 text-xs font-bold text-blue-800">{sc.label}</p>
                <div className="space-y-0.5 text-[10px] text-slate-600">
                  <div className="flex justify-between"><span>{slide.sections[0]?.heading.includes("2026") ? "2025" : "Prior"} Expenses:</span> <span className="font-semibold text-slate-800">{fmtDollar(sc.prevYearExpenses)}</span></div>
                  <div className="flex justify-between"><span>Current Expenses:</span> <span className="font-semibold text-slate-800">{fmtDollar(sc.currentYearExpenses)}</span></div>
                  <div className="flex justify-between"><span>Budget (Annual):</span> <span className="font-semibold text-slate-800">{fmtDollar(sc.annualBudget)}</span></div>
                  <div className="flex justify-between"><span>Variance:</span> <span className={`font-semibold ${sc.ytdVarianceAmt > 0 ? "text-red-600" : "text-green-600"}`}>{sc.ytdVariancePct}% ({sc.ytdVarianceAmt > 0 ? "+" : "-"}{fmtDollar(Math.abs(sc.ytdVarianceAmt))})</span></div>
                  <div className="flex justify-between"><span>Remaining:</span> <span className={`font-semibold ${sc.remainingBalance >= 0 ? "text-green-600" : "text-red-600"}`}>{fmtDollar(sc.remainingBalance)}</span></div>
                </div>
              </div>
            ))}
          </div>
        )}

        {slide.sections.map((sec, i) => (
          <div key={i}>
            <h3 className="mb-1 text-xs font-bold uppercase tracking-wide text-blue-700">{sec.heading}</h3>
            {sec.paragraphs.map((p, j) => (
              <p key={j} className="mb-1 text-xs leading-relaxed text-slate-700">{p}</p>
            ))}
          </div>
        ))}
        {slide.stationBullets.length > 0 && (
          <div>
            <h3 className="mb-1 text-xs font-bold uppercase tracking-wide text-blue-700">Station-Level Performance</h3>
            <div className="space-y-1">
              {slide.stationBullets.map((b, i) => (
                <div key={i} className="flex gap-2 text-[10px] leading-relaxed text-slate-700">
                  <span className="mt-0.5 text-blue-500">•</span>
                  <span>{b}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function DetailedSlideView({ slide, year }: { slide: DetailedSlide; year: number }) {
  const prevYear = year - 1;
  const o = slide.overallMonthly;
  return (
    <div className="flex h-full flex-col bg-white p-10">
      <h2 className="mb-4 border-b-2 border-blue-600 pb-2 text-2xl font-bold text-blue-900">{slide.title}</h2>
      <h3 className="mb-4 text-base font-bold text-slate-800">{slide.heading}</h3>

      <div className="mb-4 rounded-lg bg-slate-50 p-4">
        <p className="mb-1 text-xs font-bold uppercase text-slate-500">Overall Monthly Results (All Stations)</p>
        <div className="grid grid-cols-3 gap-3 text-sm">
          <div><span className="text-xs text-slate-500">{prevYear} Expenses:</span> <span className="font-semibold">{fmtDollar(o.prevYearExpenses)}</span></div>
          <div><span className="text-xs text-slate-500">{year} Expenses:</span> <span className="font-semibold">{fmtDollar(o.currentYearExpenses)}</span></div>
          <div><span className="text-xs text-slate-500">Budget:</span> <span className="font-semibold">{fmtDollar(o.budget)}</span></div>
          <div><span className="text-xs text-slate-500">YoY Variance:</span> <span className={`font-semibold ${o.yoyVarianceAmt > 0 ? "text-red-600" : "text-green-600"}`}>{o.yoyVariancePct}% ({o.yoyVarianceAmt > 0 ? "+" : ""}{fmtDollar(o.yoyVarianceAmt)})</span></div>
          <div><span className="text-xs text-slate-500">Budget Variance:</span> <span className={`font-semibold ${o.budgetVarianceAmt > 0 ? "text-red-600" : "text-green-600"}`}>{o.budgetVariancePct}% ({o.budgetVarianceAmt <= 0 ? "Favorable" : "Unfavorable"})</span></div>
        </div>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto">
        <p className="text-xs font-bold uppercase text-slate-500">Station-Specific Variance</p>
        {slide.stationFindings.map((f) => (
          <div key={f.station} className="rounded-lg border border-slate-200 p-3">
            <div className="mb-1 flex items-center justify-between">
              <span className="text-sm font-bold text-slate-800">{f.label}</span>
              <span className={`text-xs font-semibold ${f.varianceAmt > 0 ? "text-red-600" : "text-green-600"}`}>
                {f.variancePct}% ({f.varianceAmt > 0 ? "+" : "-"}{fmtDollar(Math.abs(f.varianceAmt))})
              </span>
            </div>
            <div className="mb-1 flex gap-4 text-xs text-slate-500">
              <span>Actual: {fmtDollar(f.actual)}</span>
              <span>Budget: {fmtDollar(f.budget)}</span>
            </div>
            <p className="text-xs leading-relaxed text-slate-600">{f.finding}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function CategoryDetailSlideView({ slide }: { slide: CategoryDetailSlide }) {
  return (
    <div className="flex h-full flex-col bg-white p-10">
      <h2 className="mb-3 border-b-2 border-blue-600 pb-2 text-2xl font-bold text-blue-900">{slide.title}</h2>
      <h3 className="mb-3 text-sm font-bold text-slate-800">{slide.heading}</h3>
      <div className="flex-1 space-y-2.5 overflow-y-auto">
        {slide.categories.map((cat, idx) => {
          const yoyColor = cat.yoyAmt > 0 ? "text-red-600" : "text-green-600";
          const budColor = cat.budgetVarianceAmt > 0 ? "text-red-600" : "text-green-600";
          return (
            <div key={cat.category} className="rounded-lg border border-slate-200 p-3">
              <div className="mb-1.5 flex items-start justify-between">
                <div>
                  <span className="mr-2 text-xs font-bold text-blue-600">{idx + 1}.</span>
                  <span className="text-sm font-bold text-slate-800">{cat.category}</span>
                </div>
                <span className="text-sm font-bold text-slate-900">{fmtDollar(cat.monthActual)}</span>
              </div>
              <div className="mb-1.5 grid grid-cols-4 gap-2 text-[10px] text-slate-600">
                <div><span className="text-slate-400">{slide.prevYear} Actual:</span> <span className="font-semibold">{fmtDollar(cat.monthPrev)}</span></div>
                <div><span className="text-slate-400">YoY:</span> <span className={`font-semibold ${yoyColor}`}>{cat.yoyPct > 0 ? "+" : ""}{cat.yoyPct}%</span></div>
                <div><span className="text-slate-400">Budget:</span> <span className="font-semibold">{fmtDollar(cat.monthBudget)}</span></div>
                <div><span className="text-slate-400">vs Budget:</span> <span className={`font-semibold ${budColor}`}>{cat.budgetVariancePct > 0 ? "+" : ""}{cat.budgetVariancePct}%</span></div>
              </div>
              {cat.stationConcentration.length > 0 && (
                <div className="flex flex-wrap gap-2 text-[10px]">
                  <span className="text-slate-400">Station:</span>
                  {cat.stationConcentration.map((sc) => (
                    <span key={sc.station} className="rounded bg-blue-50 px-1.5 py-0.5 font-medium text-blue-700">{sc.station}: {fmtDollar(sc.monthActual)}</span>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function YtdSlideView({ slide, year }: { slide: YtdSlide; year: number }) {
  const prevYear = year - 1;
  const s = slide.stats;
  return (
    <div className="flex h-full flex-col bg-white p-10">
      <h2 className="mb-4 border-b-2 border-blue-600 pb-2 text-2xl font-bold text-blue-900">{slide.title}</h2>
      <h3 className="mb-4 text-base font-bold text-slate-800">{slide.heading}</h3>

      <div className="mb-5 grid grid-cols-4 gap-3">
        <div className="rounded-lg bg-blue-50 p-3 text-center">
          <p className="text-xs text-slate-500">{prevYear} Expenses</p>
          <p className="text-lg font-bold text-slate-900">{fmtDollar(s.prevYearExpenses)}</p>
        </div>
        <div className="rounded-lg bg-blue-50 p-3 text-center">
          <p className="text-xs text-slate-500">{year} Expenses</p>
          <p className="text-lg font-bold text-slate-900">{fmtDollar(s.currentYearExpenses)}</p>
        </div>
        <div className="rounded-lg bg-blue-50 p-3 text-center">
          <p className="text-xs text-slate-500">Annual Budget</p>
          <p className="text-lg font-bold text-slate-900">{fmtDollar(s.annualBudget)}</p>
        </div>
        <div className="rounded-lg bg-green-50 p-3 text-center">
          <p className="text-xs text-slate-500">Remaining Balance</p>
          <p className={`text-lg font-bold ${s.remainingBalance >= 0 ? "text-green-700" : "text-red-600"}`}>{fmtDollar(s.remainingBalance)}</p>
        </div>
      </div>

      <div className="mb-3 flex gap-4 text-sm">
        <div className={`rounded-lg px-3 py-1 ${s.yoyVarianceAmt > 0 ? "bg-red-50 text-red-700" : "bg-green-50 text-green-700"}`}>
          YoY: {s.yoyVariancePct > 0 ? "+" : ""}{s.yoyVariancePct}% ({s.yoyVarianceAmt > 0 ? "+" : ""}{fmtDollar(s.yoyVarianceAmt)})
        </div>
        <div className={`rounded-lg px-3 py-1 ${s.ytdBudgetVarianceAmt > 0 ? "bg-red-50 text-red-700" : "bg-green-50 text-green-700"}`}>
          Budget: {s.ytdBudgetVariancePct}% ({s.ytdBudgetVarianceAmt <= 0 ? "Favorable" : "Unfavorable"})
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <h4 className="mb-2 text-xs font-bold uppercase text-slate-500">Key Observations</h4>
        <div className="space-y-2">
          {slide.observations.map((obs, i) => (
            <div key={i} className="flex gap-2 text-xs leading-relaxed text-slate-700">
              <span className="mt-0.5 text-blue-500">•</span>
              <span>{obs}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function SlidePresentation({ year, month, reportType, onClose }: { year: number; month: number; reportType: string; onClose: () => void }) {
  const { data, loading } = useData<SlidesData>(`/api/finance-report/slides?year=${year}&month=${month}&reportType=${reportType}`);
  const [currentSlide, setCurrentSlide] = useState(0);
  const slidesRef = useRef<HTMLDivElement>(null);
  const [exporting, setExporting] = useState(false);

  async function handleExportPDF() {
    if (!slidesRef.current) return;
    setExporting(true);
    try {
      const html2canvas = (await import("html2canvas-pro")).default;
      const { jsPDF } = await import("jspdf");

      const slideEls = slidesRef.current.querySelectorAll("[data-slide]");
      if (slideEls.length === 0) return;

      const first = slideEls[0] as HTMLElement;
      const canvas0 = await html2canvas(first, { scale: 2, useCORS: true, logging: false });
      const pdf = new jsPDF({
        orientation: "landscape",
        unit: "px",
        format: [canvas0.width, canvas0.height],
      });
      pdf.addImage(canvas0.toDataURL("image/png"), "PNG", 0, 0, canvas0.width, canvas0.height);

      for (let i = 1; i < slideEls.length; i++) {
        const el = slideEls[i] as HTMLElement;
        const canvas = await html2canvas(el, { scale: 2, useCORS: true, logging: false });
        pdf.addPage([canvas.width, canvas.height], "landscape");
        pdf.addImage(canvas.toDataURL("image/png"), "PNG", 0, 0, canvas.width, canvas.height);
      }

      const label = reportType === "CR" ? "Corrective_Repairs" : "PM";
      pdf.save(`${label}_Slides_${data?.monthName ?? month}_${year}.pdf`);
    } catch {
      // fallback
    } finally {
      setExporting(false);
    }
  }

  if (loading) return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="rounded-xl bg-white p-8 text-center">
        <p className="text-slate-600">Generating slides...</p>
      </div>
    </div>
  );

  if (!data) return null;

  const slides = data.slides;
  const slide = slides[currentSlide];

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-900">
      {/* Toolbar */}
      <div className="flex items-center justify-between bg-slate-800 px-4 py-2">
        <div className="flex items-center gap-3">
          <button onClick={onClose} className="rounded px-3 py-1 text-sm text-slate-300 hover:bg-slate-700 hover:text-white">
            ← Back to Report
          </button>
          <span className="text-sm text-slate-400">
            {data.reportLabel} — {data.monthName} {data.year}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-slate-400">
            Slide {currentSlide + 1} of {slides.length}
          </span>
          <button
            onClick={handleExportPDF}
            disabled={exporting}
            className="rounded bg-blue-600 px-3 py-1 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {exporting ? "Exporting..." : "Export PDF"}
          </button>
        </div>
      </div>

      {/* Slide display */}
      <div className="flex flex-1 items-center justify-center p-8">
        <div className="aspect-[16/9] w-full max-w-[960px] overflow-hidden rounded-xl shadow-2xl" ref={slidesRef}>
          <div data-slide className="h-full w-full">
            {slide.type === "cover" && <CoverSlideView slide={slide} />}
            {slide.type === "executive_summary" && <ExecSummarySlideView slide={slide} />}
            {slide.type === "detailed_analysis" && <DetailedSlideView slide={slide} year={data.year} />}
            {slide.type === "category_detail" && <CategoryDetailSlideView slide={slide} />}
            {slide.type === "ytd_summary" && <YtdSlideView slide={slide} year={data.year} />}
          </div>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-center gap-4 bg-slate-800 px-4 py-3">
        <button
          onClick={() => setCurrentSlide((p) => Math.max(0, p - 1))}
          disabled={currentSlide === 0}
          className="rounded bg-slate-700 px-4 py-1.5 text-sm text-white hover:bg-slate-600 disabled:opacity-30"
        >
          ← Previous
        </button>
        <div className="flex gap-1.5">
          {slides.map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrentSlide(i)}
              className={`h-2 w-2 rounded-full transition-colors ${
                i === currentSlide ? "bg-blue-500" : "bg-slate-600 hover:bg-slate-500"
              }`}
            />
          ))}
        </div>
        <button
          onClick={() => setCurrentSlide((p) => Math.min(slides.length - 1, p + 1))}
          disabled={currentSlide === slides.length - 1}
          className="rounded bg-slate-700 px-4 py-1.5 text-sm text-white hover:bg-slate-600 disabled:opacity-30"
        >
          Next →
        </button>
      </div>
    </div>
  );
}
