"use client";

import { useState, useRef } from "react";
import { useData } from "@/lib/use-data";
import { useFleetView } from "@/lib/use-fleet-view";
import { BRAND } from "@/lib/brand";
import { REGION_LABEL } from "@/lib/constants";
import {
  ResponsiveContainer,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ComposedChart,
  Line,
} from "recharts";

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

type TrendsChartsSlide = {
  type: "trends_charts";
  title: string;
  heading: string;
  months: string[];
  prevYear: number;
  charts: {
    monthlyActual: number[];
    monthlyPrev: number[];
    monthlyBudget: number[];
    monthlyVariancePct: (number | null)[];
    ytdActual: number[];
    ytdPrev: number[];
    ytdBudget: number[];
    ytdVariancePct: (number | null)[];
    budgetVariancePct: (number | null)[];
    ytdBudgetVariancePct: (number | null)[];
  };
};

type DataTableSlide = {
  type: "data_table";
  title: string;
  heading: string;
  stationRows: {
    station: string;
    label: string;
    prevYear: number;
    currentYear: number;
    yoyPct: number;
    yoyAmt: number;
    budget: number;
    budgetVariancePct: number;
    budgetVarianceAmt: number;
    annualBudget: number;
    remainderPct: number;
    remainderAmt: number;
  }[];
  categoryRows: {
    idx: number;
    category: string;
    prevYear: number;
    currentYear: number;
    yoyPct: number;
    yoyAmt: number;
    budget: number;
    budgetVariancePct: number;
    budgetVarianceAmt: number;
    annualBudget: number;
    remainderPct: number;
    remainderAmt: number;
  }[];
  totals: {
    prevYear: number;
    currentYear: number;
    yoyPct: number;
    yoyAmt: number;
    budget: number;
    budgetVariancePct: number;
    budgetVarianceAmt: number;
    annualBudget: number;
    remainderPct: number;
    remainderAmt: number;
  };
};

type Slide = CoverSlide | ExecSummarySlide | DetailedSlide | CategoryDetailSlide | YtdSlide | TrendsChartsSlide | DataTableSlide;

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
        <div className="mb-2 text-sm font-medium uppercase tracking-widest text-blue-200">{BRAND} {REGION_LABEL} Operations</div>
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

function fmtK(n: number): string {
  if (Math.abs(n) >= 1000) return "$" + (n / 1000).toFixed(0) + "k";
  return "$" + n.toLocaleString("en-US");
}

function TrendsChartsSlideView({ slide, year }: { slide: TrendsChartsSlide; year: number }) {
  const c = slide.charts;
  const monthlyData = slide.months.map((m, i) => ({
    month: m,
    prev: c.monthlyPrev[i],
    actual: c.monthlyActual[i],
    variance: c.monthlyVariancePct[i],
  }));
  const ytdData = slide.months.map((m, i) => ({
    month: m,
    prev: c.ytdPrev[i],
    actual: c.ytdActual[i],
    variance: c.ytdVariancePct[i],
  }));
  const budgetData = slide.months.map((m, i) => ({
    month: m,
    actual: c.monthlyActual[i],
    budget: c.monthlyBudget[i],
    variance: c.budgetVariancePct[i],
  }));
  const ytdBudgetData = slide.months.map((m, i) => ({
    month: m,
    actual: c.ytdActual[i],
    budget: c.ytdBudget[i],
    variance: c.ytdBudgetVariancePct[i],
  }));

  const chartProps = { margin: { top: 10, right: 40, left: 10, bottom: 0 } };
  const axisStyle = { fontSize: 9, fill: "#64748b" };
  const yTickFmt = (v: number) => fmtK(v);
  const pctFmt = (v: number) => `${v}%`;

  return (
    <div className="flex h-full flex-col bg-white p-6">
      <p className="mb-1 text-xs font-bold text-slate-500">{slide.heading}</p>
      <h2 className="mb-3 text-lg font-bold text-blue-900">{slide.title}</h2>
      <div className="grid flex-1 grid-cols-2 grid-rows-2 gap-3">
        {/* Chart 1: Monthly Actual YoY */}
        <div className="rounded-lg border border-slate-200 p-2">
          <p className="mb-1 text-center text-[10px] font-bold text-slate-700">{slide.prevYear}-{year} Actual | Expenses monthly variance</p>
          <ResponsiveContainer width="100%" height={150}>
            <ComposedChart data={monthlyData} {...chartProps}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="month" tick={axisStyle} />
              <YAxis yAxisId="left" tick={axisStyle} tickFormatter={yTickFmt} />
              <YAxis yAxisId="right" orientation="right" tick={axisStyle} tickFormatter={pctFmt} />
              <Tooltip formatter={(v, name) => [name === "variance" ? `${v}%` : fmtK(Number(v)), String(name)]} />
              <Legend wrapperStyle={{ fontSize: 9 }} />
              <Bar yAxisId="left" dataKey="prev" name={`A${slide.prevYear}`} fill="#94a3b8" barSize={12} />
              <Bar yAxisId="left" dataKey="actual" name={`A${year}`} fill="#3b82f6" barSize={12} />
              <Line yAxisId="right" type="monotone" dataKey="variance" name="Variance %" stroke="#1e40af" strokeWidth={2} dot={{ r: 3 }} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
        {/* Chart 2: YTD Actual YoY */}
        <div className="rounded-lg border border-slate-200 p-2">
          <p className="mb-1 text-center text-[10px] font-bold text-slate-700">{slide.prevYear}-{year} YTD | Expenses trend</p>
          <ResponsiveContainer width="100%" height={150}>
            <ComposedChart data={ytdData} {...chartProps}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="month" tick={axisStyle} />
              <YAxis yAxisId="left" tick={axisStyle} tickFormatter={yTickFmt} />
              <YAxis yAxisId="right" orientation="right" tick={axisStyle} tickFormatter={pctFmt} />
              <Tooltip formatter={(v, name) => [name === "variance" ? `${v}%` : fmtK(Number(v)), String(name)]} />
              <Legend wrapperStyle={{ fontSize: 9 }} />
              <Bar yAxisId="left" dataKey="prev" name={`A${slide.prevYear} YTD`} fill="#94a3b8" barSize={12} />
              <Bar yAxisId="left" dataKey="actual" name={`A${year} YTD`} fill="#3b82f6" barSize={12} />
              <Line yAxisId="right" type="monotone" dataKey="variance" name="Variance %" stroke="#1e40af" strokeWidth={2} dot={{ r: 3 }} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
        {/* Chart 3: Actual vs Budget Monthly */}
        <div className="rounded-lg border border-slate-200 p-2">
          <p className="mb-1 text-center text-[10px] font-bold text-slate-700">{year} Actual vs Budget | Expenses monthly variance</p>
          <ResponsiveContainer width="100%" height={150}>
            <ComposedChart data={budgetData} {...chartProps}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="month" tick={axisStyle} />
              <YAxis yAxisId="left" tick={axisStyle} tickFormatter={yTickFmt} />
              <YAxis yAxisId="right" orientation="right" tick={axisStyle} tickFormatter={pctFmt} />
              <Tooltip formatter={(v, name) => [name === "variance" ? `${v}%` : fmtK(Number(v)), String(name)]} />
              <Legend wrapperStyle={{ fontSize: 9 }} />
              <Bar yAxisId="left" dataKey="actual" name={`A${year} Monthly`} fill="#3b82f6" barSize={12} />
              <Bar yAxisId="left" dataKey="budget" name={`Budget ${year}`} fill="#f59e0b" barSize={12} />
              <Line yAxisId="right" type="monotone" dataKey="variance" name="Variance %" stroke="#1e40af" strokeWidth={2} dot={{ r: 3 }} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
        {/* Chart 4: YTD Actual vs Budget */}
        <div className="rounded-lg border border-slate-200 p-2">
          <p className="mb-1 text-center text-[10px] font-bold text-slate-700">{year} YTD Actual vs Budget | Expenses variance</p>
          <ResponsiveContainer width="100%" height={150}>
            <ComposedChart data={ytdBudgetData} {...chartProps}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="month" tick={axisStyle} />
              <YAxis yAxisId="left" tick={axisStyle} tickFormatter={yTickFmt} />
              <YAxis yAxisId="right" orientation="right" tick={axisStyle} tickFormatter={pctFmt} />
              <Tooltip formatter={(v, name) => [name === "variance" ? `${v}%` : fmtK(Number(v)), String(name)]} />
              <Legend wrapperStyle={{ fontSize: 9 }} />
              <Bar yAxisId="left" dataKey="actual" name={`A${year} YTD`} fill="#3b82f6" barSize={12} />
              <Bar yAxisId="left" dataKey="budget" name={`Budget ${year} YTD`} fill="#f59e0b" barSize={12} />
              <Line yAxisId="right" type="monotone" dataKey="variance" name="Variance %" stroke="#1e40af" strokeWidth={2} dot={{ r: 3 }} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

function DataTableSlideView({ slide, year }: { slide: DataTableSlide; year: number }) {
  const prevYear = year - 1;
  const cellCls = "px-1.5 py-1 text-right text-[8px]";
  const hdrCls = "px-1.5 py-1 text-center text-[7px] font-bold text-white";
  const varColor = (v: number) => v > 0 ? "text-red-600" : v < 0 ? "text-green-700" : "";
  const varBg = (v: number) => v > 0 ? "bg-red-50" : v < 0 ? "bg-green-50" : "";

  type Row = { label: string; prevYear: number; currentYear: number; yoyPct: number; yoyAmt: number; budget: number; budgetVariancePct: number; budgetVarianceAmt: number; annualBudget: number; remainderPct: number; remainderAmt: number };

  function renderRow(r: Row, idx?: number) {
    return (
      <tr key={r.label} className="border-b border-slate-100">
        <td className="px-1.5 py-1 text-left text-[8px] font-medium text-slate-700">
          {idx !== undefined && <span className="mr-1 text-blue-600">{idx}.</span>}
          {r.label}
        </td>
        <td className={cellCls}>{fmtDollar(r.prevYear)}</td>
        <td className={cellCls}>{fmtDollar(r.currentYear)}</td>
        <td className={`${cellCls} ${varColor(r.yoyPct)}`}>{r.yoyPct}%</td>
        <td className={`${cellCls} ${varBg(r.yoyAmt)} ${varColor(r.yoyAmt)}`}>{r.yoyAmt >= 0 ? "" : "-"}{fmtDollar(Math.abs(r.yoyAmt))}</td>
        <td className={cellCls}>{fmtDollar(r.budget)}</td>
        <td className={`${cellCls} ${varColor(r.budgetVariancePct)}`}>{r.budgetVariancePct}%</td>
        <td className={`${cellCls} ${varBg(r.budgetVarianceAmt)} ${varColor(r.budgetVarianceAmt)}`}>{r.budgetVarianceAmt >= 0 ? "" : "-"}{fmtDollar(Math.abs(r.budgetVarianceAmt))}</td>
        <td className={cellCls}>{fmtDollar(r.annualBudget)}</td>
        <td className={`${cellCls} ${varColor(-r.remainderAmt)}`}>{r.remainderPct}%</td>
        <td className={`${cellCls} ${varBg(-r.remainderAmt)}`}>{fmtDollar(r.remainderAmt)}</td>
      </tr>
    );
  }

  return (
    <div className="flex h-full flex-col bg-white p-5">
      <h2 className="mb-1 text-lg font-bold text-blue-900">{slide.title}</h2>
      <p className="mb-2 text-[10px] font-bold text-slate-500">{slide.heading}</p>
      <div className="flex-1 overflow-auto">
        {/* Station table */}
        <table className="mb-3 w-full border-collapse text-[8px]">
          <thead>
            <tr className="bg-slate-700">
              <th className={`${hdrCls} text-left`}>Station</th>
              <th className={hdrCls}>A{prevYear}</th>
              <th className={hdrCls}>A{year}</th>
              <th className={hdrCls} colSpan={2}>YoY Variance</th>
              <th className={hdrCls}>B{year}</th>
              <th className={hdrCls} colSpan={2}>Budget Variance</th>
              <th className={hdrCls}>Annual</th>
              <th className={hdrCls} colSpan={2}>Remainder</th>
            </tr>
          </thead>
          <tbody>
            {slide.stationRows.map((r) => renderRow({ label: r.label, prevYear: r.prevYear, currentYear: r.currentYear, yoyPct: r.yoyPct, yoyAmt: r.yoyAmt, budget: r.budget, budgetVariancePct: r.budgetVariancePct, budgetVarianceAmt: r.budgetVarianceAmt, annualBudget: r.annualBudget, remainderPct: r.remainderPct, remainderAmt: r.remainderAmt }))}
            <tr className="border-t-2 border-slate-400 bg-slate-100 font-bold">
              <td className="px-1.5 py-1 text-left text-[8px] font-bold">TOTAL</td>
              <td className={cellCls}>{fmtDollar(slide.totals.prevYear)}</td>
              <td className={cellCls}>{fmtDollar(slide.totals.currentYear)}</td>
              <td className={`${cellCls} ${varColor(slide.totals.yoyPct)}`}>{slide.totals.yoyPct}%</td>
              <td className={`${cellCls} ${varColor(slide.totals.yoyAmt)}`}>{fmtDollar(Math.abs(slide.totals.yoyAmt))}</td>
              <td className={cellCls}>{fmtDollar(slide.totals.budget)}</td>
              <td className={`${cellCls} ${varColor(slide.totals.budgetVariancePct)}`}>{slide.totals.budgetVariancePct}%</td>
              <td className={`${cellCls} ${varColor(slide.totals.budgetVarianceAmt)}`}>{fmtDollar(Math.abs(slide.totals.budgetVarianceAmt))}</td>
              <td className={cellCls}>{fmtDollar(slide.totals.annualBudget)}</td>
              <td className={`${cellCls} ${varColor(-slide.totals.remainderAmt)}`}>{slide.totals.remainderPct}%</td>
              <td className={cellCls}>{fmtDollar(slide.totals.remainderAmt)}</td>
            </tr>
          </tbody>
        </table>

        {/* Category table */}
        <p className="mb-1 text-[9px] font-bold text-slate-600">Services - Consolidated {REGION_LABEL}</p>
        <table className="w-full border-collapse text-[8px]">
          <thead>
            <tr className="bg-emerald-700">
              <th className={`${hdrCls} text-left`}>#</th>
              <th className={`${hdrCls} text-left`}>Category</th>
              <th className={hdrCls}>A{prevYear}</th>
              <th className={hdrCls}>A{year}</th>
              <th className={hdrCls} colSpan={2}>YoY Variance</th>
              <th className={hdrCls}>B{year}</th>
              <th className={hdrCls} colSpan={2}>Budget Variance</th>
              <th className={hdrCls}>Annual</th>
              <th className={hdrCls} colSpan={2}>Remainder</th>
            </tr>
          </thead>
          <tbody>
            {slide.categoryRows.map((r) => (
              <tr key={r.category} className="border-b border-slate-100">
                <td className="px-1.5 py-1 text-[8px] text-blue-600 font-bold">{r.idx}</td>
                <td className="px-1.5 py-1 text-left text-[8px] font-medium text-slate-700">{r.category}</td>
                <td className={cellCls}>{fmtDollar(r.prevYear)}</td>
                <td className={cellCls}>{fmtDollar(r.currentYear)}</td>
                <td className={`${cellCls} ${varColor(r.yoyPct)}`}>{r.yoyPct}%</td>
                <td className={`${cellCls} ${varBg(r.yoyAmt)} ${varColor(r.yoyAmt)}`}>{r.yoyAmt >= 0 ? "" : "-"}{fmtDollar(Math.abs(r.yoyAmt))}</td>
                <td className={cellCls}>{fmtDollar(r.budget)}</td>
                <td className={`${cellCls} ${varColor(r.budgetVariancePct)}`}>{r.budgetVariancePct}%</td>
                <td className={`${cellCls} ${varBg(r.budgetVarianceAmt)} ${varColor(r.budgetVarianceAmt)}`}>{r.budgetVarianceAmt >= 0 ? "" : "-"}{fmtDollar(Math.abs(r.budgetVarianceAmt))}</td>
                <td className={cellCls}>{fmtDollar(r.annualBudget)}</td>
                <td className={`${cellCls} ${varColor(-r.remainderAmt)}`}>{r.remainderPct}%</td>
                <td className={`${cellCls} ${varBg(-r.remainderAmt)}`}>{fmtDollar(r.remainderAmt)}</td>
              </tr>
            ))}
            <tr className="border-t-2 border-slate-400 bg-slate-100 font-bold">
              <td className="px-1.5 py-1 text-[8px]" colSpan={2}>TOTAL</td>
              <td className={cellCls}>{fmtDollar(slide.totals.prevYear)}</td>
              <td className={cellCls}>{fmtDollar(slide.totals.currentYear)}</td>
              <td className={`${cellCls} ${varColor(slide.totals.yoyPct)}`}>{slide.totals.yoyPct}%</td>
              <td className={`${cellCls} ${varColor(slide.totals.yoyAmt)}`}>{fmtDollar(Math.abs(slide.totals.yoyAmt))}</td>
              <td className={cellCls}>{fmtDollar(slide.totals.budget)}</td>
              <td className={`${cellCls} ${varColor(slide.totals.budgetVariancePct)}`}>{slide.totals.budgetVariancePct}%</td>
              <td className={`${cellCls} ${varColor(slide.totals.budgetVarianceAmt)}`}>{fmtDollar(Math.abs(slide.totals.budgetVarianceAmt))}</td>
              <td className={cellCls}>{fmtDollar(slide.totals.annualBudget)}</td>
              <td className={`${cellCls} ${varColor(-slide.totals.remainderAmt)}`}>{slide.totals.remainderPct}%</td>
              <td className={cellCls}>{fmtDollar(slide.totals.remainderAmt)}</td>
            </tr>
          </tbody>
        </table>
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
  const fleetView = useFleetView();
  const { data, loading } = useData<SlidesData>(`/api/finance-report/slides?year=${year}&month=${month}&reportType=${reportType}&fv=${fleetView}`);
  const [currentSlide, setCurrentSlide] = useState(0);
  const slidesRef = useRef<HTMLDivElement>(null);
  const allSlidesRef = useRef<HTMLDivElement>(null);
  const [exporting, setExporting] = useState(false);

  async function handleExportPDF() {
    if (!allSlidesRef.current) return;
    setExporting(true);
    try {
      const html2canvas = (await import("html2canvas-pro")).default;
      const { jsPDF } = await import("jspdf");

      const slideEls = allSlidesRef.current.querySelectorAll("[data-slide]");
      if (slideEls.length === 0) return;

      const margin = 60;
      const first = slideEls[0] as HTMLElement;
      const canvasOpts = { scale: 2, useCORS: true, logging: false, scrollY: 0, scrollX: 0, windowHeight: first.scrollHeight + 100 };
      const canvas0 = await html2canvas(first, canvasOpts);
      const pdfW = canvas0.width + margin * 2;
      const pdfH = canvas0.height + margin * 2;
      const pdf = new jsPDF({
        orientation: "landscape",
        unit: "px",
        format: [pdfW, pdfH],
      });
      pdf.addImage(canvas0.toDataURL("image/png"), "PNG", margin, margin, canvas0.width, canvas0.height);

      for (let i = 1; i < slideEls.length; i++) {
        const el = slideEls[i] as HTMLElement;
        const canvas = await html2canvas(el, { ...canvasOpts, windowHeight: el.scrollHeight + 100 });
        pdf.addPage([canvas.width + margin * 2, canvas.height + margin * 2], "landscape");
        pdf.addImage(canvas.toDataURL("image/png"), "PNG", margin, margin, canvas.width, canvas.height);
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
          <span className="rounded bg-blue-600 px-2 py-0.5 text-xs font-bold text-white">
            {data.monthName} {data.year}
          </span>
          <span className="text-sm text-slate-400">
            {data.reportLabel}
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
            {slide.type === "trends_charts" && <TrendsChartsSlideView slide={slide} year={data.year} />}
            {slide.type === "detailed_analysis" && <DetailedSlideView slide={slide} year={data.year} />}
            {slide.type === "category_detail" && <CategoryDetailSlideView slide={slide} />}
            {slide.type === "data_table" && <DataTableSlideView slide={slide} year={data.year} />}
            {slide.type === "ytd_summary" && <YtdSlideView slide={slide} year={data.year} />}
          </div>
        </div>
      </div>

      {/* Hidden container with ALL slides for PDF export — no height constraints so full content is captured */}
      <div ref={allSlidesRef} className="fixed left-[-9999px] top-0" style={{ overflow: "visible" }}>
        {slides.map((s, i) => (
          <div key={i} data-slide className="w-[960px] bg-white" style={{ minHeight: 540, overflow: "visible" }}>
            {s.type === "cover" && <CoverSlideView slide={s} />}
            {s.type === "executive_summary" && <ExecSummarySlideView slide={s} />}
            {s.type === "trends_charts" && <TrendsChartsSlideView slide={s} year={data.year} />}
            {s.type === "detailed_analysis" && <DetailedSlideView slide={s} year={data.year} />}
            {s.type === "category_detail" && <CategoryDetailSlideView slide={s} />}
            {s.type === "data_table" && <DataTableSlideView slide={s} year={data.year} />}
            {s.type === "ytd_summary" && <YtdSlideView slide={s} year={data.year} />}
          </div>
        ))}
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
