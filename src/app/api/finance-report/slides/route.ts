import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireApiUser } from "@/lib/api";
import { PM_CATEGORIES, WO_TITLE_TO_PM_CATEGORY, CR_CATEGORIES, WO_TITLE_TO_CR_CATEGORY, STATIONS, REGION_LABEL, REGION_ABBR } from "@/lib/constants";
import { BRAND } from "@/lib/brand";

const ALL_STATIONS = STATIONS as readonly string[];
const MONTHS_FULL = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

const STATION_LABELS: Record<string, string> = {
  ALL: `All Stations - Consolidated ${REGION_ABBR}`,
  IAH: "IAH - Houston",
  AUS: "AUS - Austin",
  HRL: "HRL - Harlingen",
  LRD: "LRD - Laredo",
  ACT: "ACT - Waco",
  CLL: "CLL - College Station",
  BPT: "BPT - Beaumont",
};

function classifyPM(title: string): string | null {
  if (WO_TITLE_TO_PM_CATEGORY[title]) return WO_TITLE_TO_PM_CATEGORY[title];
  const lower = title.toLowerCase();
  if (lower.includes("brake pad") || lower.includes("brake rotor") || lower.includes("air brake")) return "Brakes";
  if (lower.includes("tire")) return "Tires Replacement";
  if (lower.includes("oil change") || lower.includes("pm a") || lower.includes("pm b") || lower.includes("pm c")) return "Oil Change";
  if (lower.includes("caliper")) return "Brake Calipers";
  if (lower.includes("drivetrain")) return "Drivetrain Overhaul";
  if (lower.includes("transmission")) return "Transmission Fluid";
  if (lower.includes("coolant") || lower.includes("spark plug")) return "Coolant + Spark plugs";
  if (lower.includes("timing") || lower.includes("time belt")) return "Time Belt";
  if (lower.includes("diesel filter")) return "Diesel Filter Cleaning";
  if (lower.includes("engine filter") || lower.includes("engine air filter") || lower.includes("air filter")) return "Engine Filter";
  if (lower.includes("battery")) return "Battery Replacement";
  if (lower.includes("fluid")) return "Fluids";
  if (lower.includes("wiper")) return "Wiper Replacement";
  if (lower.includes("turbo")) return "Turbo Charger Inspection";
  if (lower.includes("dot") || lower.includes("inspection")) return "Brakes";
  return null;
}

function classifyCR(title: string): string | null {
  if (WO_TITLE_TO_CR_CATEGORY[title]) return WO_TITLE_TO_CR_CATEGORY[title];
  const lower = title.toLowerCase();
  if (lower.includes("engine") || lower.includes("def system") || lower.includes("turbo") || lower.includes("actuator")) return "Engine Services";
  if (lower.includes("electric") || lower.includes("wiring") || lower.includes("fuse")) return "Electrical Repairs";
  if (lower.includes("ac ") || lower.includes("a/c") || lower.includes("heating") || lower.includes("hvac")) return "A/C & Heating";
  if (
    lower.includes("body") ||
    lower.includes("cosmetic") ||
    lower.includes("paint") ||
    lower.includes("dent") ||
    lower.includes("registration") ||
    lower.includes("wash") ||
    lower.includes("detail") ||
    lower.includes("decal") ||
    lower.includes("sticker") ||
    lower.includes("samsara") ||
    lower.includes("key replacement") ||
    lower.includes("key programming") ||
    lower.includes("door") ||
    lower.includes("latch") ||
    lower.includes("roller") ||
    lower.includes("windshield") ||
    lower.includes("bumper") ||
    lower.includes("headlight") ||
    lower.includes("trim")
  ) return "Cosmetic / Utility";
  // Explicitly corrective mechanical work.
  if (
    lower.includes("transmission") ||
    lower.includes("radiator") ||
    lower.includes("cooling system") ||
    lower.includes("suspension") ||
    lower.includes("exhaust") ||
    lower.includes("drivetrain overhaul") ||
    lower.includes("repair") ||
    lower.includes("replace part")
  ) return "Mechanical Repairs";
  // Anything the preventive classifier recognizes is scheduled PM — never corrective.
  if (classifyPM(title) !== null) return null;
  return "Mechanical Repairs";
}

function fmtDollar(n: number): string {
  return "$" + Math.abs(n).toLocaleString("en-US");
}

function varianceWord(pct: number): string {
  if (pct <= -20) return "significantly under";
  if (pct < -5) return "under";
  if (pct <= 5) return "on";
  if (pct <= 20) return "above";
  return "significantly above";
}

function favorableUnfavorable(amt: number): string {
  return amt <= 0 ? "favorable" : "unfavorable";
}

export async function GET(req: NextRequest) {
  const auth = await requireApiUser();
  if ("error" in auth) return auth.error;

  const url = new URL(req.url);
  const year = parseInt(url.searchParams.get("year") ?? String(new Date().getFullYear()));
  const month = parseInt(url.searchParams.get("month") ?? String(new Date().getMonth() + 1));
  const reportType = url.searchParams.get("reportType") ?? "PM";
  const prevYear = year - 1;

  const CATEGORIES = reportType === "CR" ? CR_CATEGORIES : PM_CATEGORIES;
  const classify = reportType === "CR" ? classifyCR : classifyPM;
  const reportLabel = reportType === "CR" ? "Corrective Repair" : "Preventive Maintenance";
  const reportLabelShort = reportType === "CR" ? "CR" : "PM";

  const budgets = await prisma.pmBudget.findMany({ where: { year } });

  const woFullYear = await prisma.workOrder.findMany({
    where: {
      status: "COMPLETED",
      completedAt: { gte: new Date(year, 0, 1), lte: new Date(year, 11, 31, 23, 59, 59) },
    },
    include: { vehicle: { select: { station: true } } },
  });

  const woFullPrev = await prisma.workOrder.findMany({
    where: {
      status: "COMPLETED",
      completedAt: { gte: new Date(prevYear, 0, 1), lte: new Date(prevYear, 11, 31, 23, 59, 59) },
    },
    include: { vehicle: { select: { station: true } } },
  });

  type CategoryDetail = { category: string; monthActual: number; monthPrev: number; monthBudget: number; ytdActual: number; ytdPrev: number; ytdBudget: number; annualBudget: number };
  type StationTotals = {
    monthActual: number;
    monthBudget: number;
    monthPrev: number;
    ytdActual: number;
    ytdBudget: number;
    ytdPrev: number;
    annualBudget: number;
    categories: CategoryDetail[];
  };

  function computeStation(station: string): StationTotals {
    const catData: Record<string, { monthActual: number; monthPrev: number; ytdActual: number; ytdPrev: number }> = {};
    for (const cat of CATEGORIES) {
      catData[cat] = { monthActual: 0, monthPrev: 0, ytdActual: 0, ytdPrev: 0 };
    }

    for (const wo of woFullYear) {
      const woStation = wo.station ?? wo.vehicle?.station ?? "IAH";
      if (station !== "ALL" && woStation !== station) continue;
      const cat = classify(wo.title);
      if (!cat || !(CATEGORIES as readonly string[]).includes(cat)) continue;
      const woMonth = wo.completedAt ? new Date(wo.completedAt).getMonth() + 1 : 0;
      const cost = wo.cost ?? 0;
      if (woMonth <= month) catData[cat].ytdActual += cost;
      if (woMonth === month) catData[cat].monthActual += cost;
    }

    for (const wo of woFullPrev) {
      const woStation = wo.station ?? wo.vehicle?.station ?? "IAH";
      if (station !== "ALL" && woStation !== station) continue;
      const cat = classify(wo.title);
      if (!cat || !(CATEGORIES as readonly string[]).includes(cat)) continue;
      const woMonth = wo.completedAt ? new Date(wo.completedAt).getMonth() + 1 : 0;
      const cost = wo.cost ?? 0;
      if (woMonth <= month) catData[cat].ytdPrev += cost;
      if (woMonth === month) catData[cat].monthPrev += cost;
    }

    let monthBudget = 0;
    let ytdBudget = 0;
    let annualBudget = 0;
    const catMonthBudgets: Record<string, number> = {};
    const catYtdBudgets: Record<string, number> = {};
    const catAnnualBudgets: Record<string, number> = {};
    for (const cat of CATEGORIES) { catMonthBudgets[cat] = 0; catYtdBudgets[cat] = 0; catAnnualBudgets[cat] = 0; }

    for (const b of budgets) {
      if (station !== "ALL" && b.station !== station) continue;
      if (!(CATEGORIES as readonly string[]).includes(b.category)) continue;
      annualBudget += b.amount;
      catAnnualBudgets[b.category] = (catAnnualBudgets[b.category] ?? 0) + b.amount;
      if (b.month <= month) { ytdBudget += b.amount; catYtdBudgets[b.category] = (catYtdBudgets[b.category] ?? 0) + b.amount; }
      if (b.month === month) { monthBudget += b.amount; catMonthBudgets[b.category] = (catMonthBudgets[b.category] ?? 0) + b.amount; }
    }

    const monthActual = Object.values(catData).reduce((s, c) => s + c.monthActual, 0);
    const monthPrev = Object.values(catData).reduce((s, c) => s + c.monthPrev, 0);
    const ytdActual = Object.values(catData).reduce((s, c) => s + c.ytdActual, 0);
    const ytdPrev = Object.values(catData).reduce((s, c) => s + c.ytdPrev, 0);

    const categories = (CATEGORIES as readonly string[]).map((cat) => ({
      category: cat,
      monthActual: Math.round(catData[cat].monthActual),
      monthPrev: Math.round(catData[cat].monthPrev),
      monthBudget: Math.round(catMonthBudgets[cat] ?? 0),
      ytdActual: Math.round(catData[cat].ytdActual),
      ytdPrev: Math.round(catData[cat].ytdPrev),
      ytdBudget: Math.round(catYtdBudgets[cat] ?? 0),
      annualBudget: Math.round(catAnnualBudgets[cat] ?? 0),
    }));

    return { monthActual: Math.round(monthActual), monthBudget: Math.round(monthBudget), monthPrev: Math.round(monthPrev), ytdActual: Math.round(ytdActual), ytdBudget: Math.round(ytdBudget), ytdPrev: Math.round(ytdPrev), annualBudget: Math.round(annualBudget), categories };
  }

  const consolidated = computeStation("ALL");
  const stationData: Record<string, StationTotals> = {};
  for (const s of ALL_STATIONS) {
    stationData[s] = computeStation(s);
  }

  // Generate narrative slides
  const monthName = MONTHS_FULL[month - 1];

  // Slide 1: Cover
  const coverSlide = {
    type: "cover" as const,
    title: `${prevYear}-${year} ${BRAND} ${reportLabel} Expenses`,
    subtitle: `${year} ${monthName.toUpperCase()} Actual to Budget Variance Analysis`,
    bullets: [
      `${REGION_LABEL} Operations`,
      ...ALL_STATIONS.filter((s) => {
        const d = stationData[s];
        return d.ytdActual > 0 || d.annualBudget > 0;
      }).map((s) => STATION_LABELS[s] ?? s),
    ],
    footer: `${reportLabelShort} Expenses & Invoices Updated as of ${new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric", timeZone: "America/Chicago" })}`,
  };

  // Slide 2: Executive Summary
  const monthVarianceAmt = consolidated.monthActual - consolidated.monthBudget;
  const monthVariancePct = consolidated.monthBudget > 0 ? Math.round(((consolidated.monthActual - consolidated.monthBudget) / consolidated.monthBudget) * 100) : 0;
  const ytdVarianceAmt = consolidated.ytdActual - consolidated.ytdBudget;
  const ytdVariancePct = consolidated.ytdBudget > 0 ? Math.round(((consolidated.ytdActual - consolidated.ytdBudget) / consolidated.ytdBudget) * 100) : 0;
  const budgetUtilPct = consolidated.annualBudget > 0 ? Math.round((consolidated.ytdActual / consolidated.annualBudget) * 100) : 0;
  const remainderAmt = consolidated.annualBudget - consolidated.ytdActual;

  const ytdNarrative = `At the end of ${monthName} ${year}, consolidated ${REGION_LABEL} operations had utilized approximately ${budgetUtilPct}% of the annual ${reportLabel.toLowerCase()} budget, leaving ${fmtDollar(remainderAmt)} available for the remainder of the year.`;

  const monthNarrative = `Total ${monthName} ${year} ${reportLabelShort} spend closed at ${fmtDollar(consolidated.monthActual)} compared to a monthly budget of ${fmtDollar(consolidated.monthBudget)}, resulting in a ${Math.abs(monthVariancePct)}% ${favorableUnfavorable(monthVarianceAmt)} variance (${monthVarianceAmt <= 0 ? "-" : "+"}${fmtDollar(Math.abs(monthVarianceAmt))}).`;

  const ytdSummary = `Through ${monthName} ${year}, consolidated ${reportLabelShort} spend totaled ${fmtDollar(consolidated.ytdActual)} against a YTD budget of ${fmtDollar(consolidated.ytdBudget)}, remaining ${Math.abs(ytdVariancePct)}% ${varianceWord(ytdVariancePct)} budget (${ytdVarianceAmt <= 0 ? "-" : "+"}${fmtDollar(Math.abs(ytdVarianceAmt))} ${favorableUnfavorable(ytdVarianceAmt)}).`;

  // Station-level YTD bullets
  const stationBullets: string[] = [];
  const activeStations = ALL_STATIONS.filter((s) => {
    const d = stationData[s];
    return d.ytdActual > 0 || d.annualBudget > 0;
  });
  for (const s of activeStations) {
    const d = stationData[s];
    const varAmt = d.monthActual - d.monthBudget;
    const varPct = d.monthBudget > 0 ? Math.round(((d.monthActual - d.monthBudget) / d.monthBudget) * 100) : 0;
    const topCats = d.categories.filter((c) => c.monthActual > 0).sort((a, b) => b.monthActual - a.monthActual).map((c) => c.category.toLowerCase()).slice(0, 2);
    const drivers = topCats.length > 0 ? ` Spending driven primarily by ${topCats.join(" and ")} activity.` : "";
    stationBullets.push(
      `${STATION_LABELS[s] ?? s}: ${monthName} spend of ${fmtDollar(d.monthActual)} vs budget of ${fmtDollar(d.monthBudget)} (${Math.abs(varPct)}% ${favorableUnfavorable(varAmt)}).${drivers}`
    );
  }

  // Station YTD summary cards (like page 2 of PDF)
  const stationCards = activeStations.map((s) => {
    const d = stationData[s];
    const ytdVar = d.ytdBudget > 0 ? Math.round(((d.ytdActual - d.ytdBudget) / d.ytdBudget) * 100) : 0;
    return {
      station: s,
      label: STATION_LABELS[s] ?? s,
      prevYearExpenses: d.ytdPrev,
      currentYearExpenses: d.ytdActual,
      annualBudget: d.annualBudget,
      ytdVariancePct: ytdVar,
      ytdVarianceAmt: d.ytdActual - d.ytdBudget,
      remainingBalance: d.annualBudget - d.ytdActual,
    };
  });

  const executiveSummarySlide = {
    type: "executive_summary" as const,
    title: `${reportLabel} Executive Summary`,
    sections: [
      {
        heading: `${year} Year-to-Date ${reportLabelShort} Results Trends: Actual to Budget Variance Analysis`,
        paragraphs: [ytdNarrative, ytdSummary],
      },
      {
        heading: `${year} Monthly Results Trends: Actual to Budget Variance Analysis`,
        paragraphs: [monthNarrative],
      },
    ],
    stationBullets,
    stationCards,
  };

  // Slide 3: Detailed Variance Analysis per station
  const detailedFindings: { station: string; label: string; actual: number; budget: number; variancePct: number; varianceAmt: number; finding: string }[] = [];
  for (const s of activeStations) {
    const d = stationData[s];
    const varAmt = d.monthActual - d.monthBudget;
    const varPct = d.monthBudget > 0 ? Math.round(((d.monthActual - d.monthBudget) / d.monthBudget) * 100) : 0;
    const topCats = d.categories.filter((c) => c.monthActual > 0).sort((a, b) => b.monthActual - a.monthActual).map((c) => c.category.toLowerCase());
    const aboveBelow = varAmt > 0 ? "exceeded budget" : "finished below budget";
    const drivers = topCats.length > 0 ? ` primarily due to ${topCats.slice(0, 2).join(" and ")} activity` : "";
    detailedFindings.push({
      station: s,
      label: STATION_LABELS[s] ?? s,
      actual: d.monthActual,
      budget: d.monthBudget,
      variancePct: varPct,
      varianceAmt: varAmt,
      finding: `${STATION_LABELS[s]?.split(" - ")[1] ?? s} ${aboveBelow} for ${monthName}${drivers}. ${
        d.ytdActual < d.ytdBudget
          ? `Despite the monthly variance, ${s} remains under its year-to-date budget.`
          : d.ytdActual > d.ytdBudget
            ? `Year-to-date spending remains above budget targets.`
            : `Year-to-date spending is on track with budget.`
      }`,
    });
  }

  const detailedSlide = {
    type: "detailed_analysis" as const,
    title: `${reportLabel} Detailed Variance Analysis`,
    heading: `Key Findings in ${monthName} Variance Analysis`,
    overallMonthly: {
      prevYearExpenses: consolidated.monthPrev,
      currentYearExpenses: consolidated.monthActual,
      yoyVariancePct: consolidated.monthPrev > 0 ? Math.round(((consolidated.monthActual - consolidated.monthPrev) / consolidated.monthPrev) * 100) : 0,
      yoyVarianceAmt: consolidated.monthActual - consolidated.monthPrev,
      budget: consolidated.monthBudget,
      budgetVariancePct: monthVariancePct,
      budgetVarianceAmt: monthVarianceAmt,
    },
    stationFindings: detailedFindings,
  };

  // Slide 4: Per-category detailed analysis with station concentration
  const categoryDetails = consolidated.categories.map((cat) => {
    const stationConcentration = activeStations.map((s) => {
      const sCat = stationData[s].categories.find((c) => c.category === cat.category);
      return { station: s, monthActual: sCat?.monthActual ?? 0 };
    }).filter((sc) => sc.monthActual > 0);

    const yoyPct = cat.monthPrev > 0 ? Math.round(((cat.monthActual - cat.monthPrev) / cat.monthPrev) * 100) : (cat.monthActual > 0 ? 100 : 0);
    const budVarPct = cat.monthBudget > 0 ? Math.round(((cat.monthActual - cat.monthBudget) / cat.monthBudget) * 100) : 0;

    return {
      category: cat.category,
      monthActual: cat.monthActual,
      monthPrev: cat.monthPrev,
      monthBudget: cat.monthBudget,
      yoyPct,
      yoyAmt: cat.monthActual - cat.monthPrev,
      budgetVariancePct: budVarPct,
      budgetVarianceAmt: cat.monthActual - cat.monthBudget,
      stationConcentration,
    };
  });

  const categorySlide = {
    type: "category_detail" as const,
    title: `${reportLabel} Detailed Analysis`,
    heading: `${reportLabelShort === "CR" ? "Repair Type" : "Service Type"} Allocation`,
    categories: categoryDetails,
    monthName,
    year,
    prevYear,
  };

  // Slide 5: YTD Performance Summary
  const ytdSlide = {
    type: "ytd_summary" as const,
    title: `${reportLabel} Detailed Variance Analysis`,
    heading: `Total ${reportLabelShort} Services (All Types)`,
    stats: {
      prevYearExpenses: consolidated.ytdPrev,
      currentYearExpenses: consolidated.ytdActual,
      yoyVariancePct: consolidated.ytdPrev > 0 ? Math.round(((consolidated.ytdActual - consolidated.ytdPrev) / consolidated.ytdPrev) * 100) : 0,
      yoyVarianceAmt: consolidated.ytdActual - consolidated.ytdPrev,
      annualBudget: consolidated.annualBudget,
      ytdBudgetVariancePct: ytdVariancePct,
      ytdBudgetVarianceAmt: ytdVarianceAmt,
      remainingBalance: remainderAmt,
    },
    observations: generateObservations(consolidated, stationData, reportLabelShort, monthName, year, activeStations),
  };

  // Slide 6: Monthly Trends Charts
  const MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  // Build monthly actual/prev/budget arrays for all 12 months
  const monthlyActual: number[] = Array(12).fill(0);
  const monthlyPrev: number[] = Array(12).fill(0);
  const monthlyBudget: number[] = Array(12).fill(0);

  for (const wo of woFullYear) {
    const cat = classify(wo.title);
    if (!cat || !(CATEGORIES as readonly string[]).includes(cat)) continue;
    const m = wo.completedAt ? new Date(wo.completedAt).getMonth() : -1;
    if (m >= 0) monthlyActual[m] += wo.cost ?? 0;
  }
  for (const wo of woFullPrev) {
    const cat = classify(wo.title);
    if (!cat || !(CATEGORIES as readonly string[]).includes(cat)) continue;
    const m = wo.completedAt ? new Date(wo.completedAt).getMonth() : -1;
    if (m >= 0) monthlyPrev[m] += wo.cost ?? 0;
  }
  for (const b of budgets) {
    if (!(CATEGORIES as readonly string[]).includes(b.category)) continue;
    if (b.month >= 1 && b.month <= 12) monthlyBudget[b.month - 1] += b.amount;
  }

  // YTD cumulative
  const ytdActualCum: number[] = [];
  const ytdPrevCum: number[] = [];
  const ytdBudgetCum: number[] = [];
  let cumA = 0, cumP = 0, cumB = 0;
  for (let i = 0; i < 12; i++) {
    cumA += monthlyActual[i]; ytdActualCum.push(Math.round(cumA));
    cumP += monthlyPrev[i]; ytdPrevCum.push(Math.round(cumP));
    cumB += monthlyBudget[i]; ytdBudgetCum.push(Math.round(cumB));
  }

  // Monthly variance %
  const monthlyVariancePct = monthlyActual.map((a, i) => {
    const p = monthlyPrev[i];
    return p > 0 ? Math.round(((a - p) / p) * 100) : 0;
  });
  const ytdVariancePctArr = ytdActualCum.map((a, i) => {
    const p = ytdPrevCum[i];
    return p > 0 ? Math.round(((a - p) / p) * 100) : 0;
  });
  const budgetVariancePctArr = monthlyActual.map((a, i) => {
    const b = monthlyBudget[i];
    return b > 0 ? Math.round(((a - b) / b) * 100) : 0;
  });
  const ytdBudgetVarPctArr = ytdActualCum.map((a, i) => {
    const b = ytdBudgetCum[i];
    return b > 0 ? Math.round(((a - b) / b) * 100) : 0;
  });

  const trendsSlide = {
    type: "trends_charts" as const,
    title: `${prevYear}-${year} ${reportLabel} Expenses Trends`,
    heading: `${REGION_ABBR} - Consolidated`,
    months: MONTHS_SHORT,
    prevYear,
    charts: {
      monthlyActual: monthlyActual.map(Math.round),
      monthlyPrev: monthlyPrev.map(Math.round),
      monthlyBudget: monthlyBudget.map(Math.round),
      monthlyVariancePct,
      ytdActual: ytdActualCum,
      ytdPrev: ytdPrevCum,
      ytdBudget: ytdBudgetCum,
      ytdVariancePct: ytdVariancePctArr,
      budgetVariancePct: budgetVariancePctArr,
      ytdBudgetVariancePct: ytdBudgetVarPctArr,
    },
  };

  // Slide 7: Data Table (station + category breakdown)
  const stationRows = activeStations.map((s) => {
    const d = stationData[s];
    const yoyPct = d.ytdPrev > 0 ? Math.round(((d.ytdActual - d.ytdPrev) / d.ytdPrev) * 100) : 0;
    const budVarPct = d.ytdBudget > 0 ? Math.round(((d.ytdActual - d.ytdBudget) / d.ytdBudget) * 100) : 0;
    const remPct = d.annualBudget > 0 ? Math.round(((d.annualBudget - d.ytdActual) / d.annualBudget) * 100) : 0;
    return {
      station: s,
      label: STATION_LABELS[s] ?? s,
      prevYear: d.ytdPrev,
      currentYear: d.ytdActual,
      yoyPct,
      yoyAmt: d.ytdActual - d.ytdPrev,
      budget: d.ytdBudget,
      budgetVariancePct: budVarPct,
      budgetVarianceAmt: d.ytdActual - d.ytdBudget,
      annualBudget: d.annualBudget,
      remainderPct: remPct,
      remainderAmt: d.annualBudget - d.ytdActual,
    };
  });

  const categoryRows = consolidated.categories.map((cat, idx) => {
    const yoyPct = cat.ytdPrev > 0 ? Math.round(((cat.ytdActual - cat.ytdPrev) / cat.ytdPrev) * 100) : (cat.ytdActual > 0 ? 100 : 0);
    const budVarPct = cat.ytdBudget > 0 ? Math.round(((cat.ytdActual - cat.ytdBudget) / cat.ytdBudget) * 100) : 0;
    const remPct = cat.annualBudget > 0 ? Math.round(((cat.annualBudget - cat.ytdActual) / cat.annualBudget) * 100) : 0;
    return {
      idx: idx + 1,
      category: cat.category,
      prevYear: cat.ytdPrev,
      currentYear: cat.ytdActual,
      yoyPct,
      yoyAmt: cat.ytdActual - cat.ytdPrev,
      budget: cat.ytdBudget,
      budgetVariancePct: budVarPct,
      budgetVarianceAmt: cat.ytdActual - cat.ytdBudget,
      annualBudget: cat.annualBudget,
      remainderPct: remPct,
      remainderAmt: cat.annualBudget - cat.ytdActual,
    };
  });

  const totYoyPct = consolidated.ytdPrev > 0 ? Math.round(((consolidated.ytdActual - consolidated.ytdPrev) / consolidated.ytdPrev) * 100) : 0;
  const totRemPct = consolidated.annualBudget > 0 ? Math.round(((consolidated.annualBudget - consolidated.ytdActual) / consolidated.annualBudget) * 100) : 0;

  const dataTableSlide = {
    type: "data_table" as const,
    title: `${BRAND} / Fleet ${reportLabel} Expenses — ${year}`,
    heading: `Year to Date Results — ${monthName} ${year} — All Stations Consolidated ${REGION_ABBR}`,
    stationRows,
    categoryRows,
    totals: {
      prevYear: consolidated.ytdPrev,
      currentYear: consolidated.ytdActual,
      yoyPct: totYoyPct,
      yoyAmt: consolidated.ytdActual - consolidated.ytdPrev,
      budget: consolidated.ytdBudget,
      budgetVariancePct: ytdVariancePct,
      budgetVarianceAmt: ytdVarianceAmt,
      annualBudget: consolidated.annualBudget,
      remainderPct: totRemPct,
      remainderAmt: remainderAmt,
    },
  };

  const slides = [coverSlide, executiveSummarySlide, trendsSlide, dataTableSlide, detailedSlide, categorySlide, ytdSlide];

  return NextResponse.json({
    year,
    month,
    monthName,
    reportType,
    reportLabel,
    slides,
  });
}

function generateObservations(
  consolidated: { ytdActual: number; ytdPrev: number; annualBudget: number; ytdBudget: number },
  stationData: Record<string, { monthActual: number; monthBudget: number; ytdActual: number; ytdBudget: number; categories: { category: string; monthActual: number }[] }>,
  reportLabelShort: string,
  monthName: string,
  year: number,
  activeStations: string[],
): string[] {
  void activeStations;
  const observations: string[] = [];
  const yoyPct = consolidated.ytdPrev > 0 ? Math.round(((consolidated.ytdActual - consolidated.ytdPrev) / consolidated.ytdPrev) * 100) : 0;
  const budgetUtilPct = consolidated.annualBudget > 0 ? Math.round((consolidated.ytdActual / consolidated.annualBudget) * 100) : 0;

  if (yoyPct > 0) {
    observations.push(`${reportLabelShort} expenses increased ${yoyPct}% year-over-year through ${monthName}, reflecting higher fleet utilization and continued investment in maintenance activities across ${REGION_LABEL} operations.`);
  } else if (yoyPct < 0) {
    observations.push(`${reportLabelShort} expenses decreased ${Math.abs(yoyPct)}% year-over-year through ${monthName}, demonstrating improved maintenance cost control.`);
  }

  if (consolidated.ytdActual < consolidated.ytdBudget) {
    observations.push(`Despite spending trends, overall ${reportLabelShort} spending remains below budget, demonstrating disciplined maintenance planning and execution.`);
  }

  observations.push(`Budget utilization remains ${consolidated.ytdActual <= consolidated.ytdBudget ? "favorable" : "elevated"}, with approximately ${budgetUtilPct}% of the annual ${reportLabelShort} budget utilized year-to-date.`);

  // Overspending stations
  const overSpending = Object.entries(stationData)
    .filter(([, d]) => d.ytdActual > d.ytdBudget && d.ytdBudget > 0)
    .map(([s]) => s);
  if (overSpending.length > 0) {
    observations.push(`${overSpending.join(", ")} ${overSpending.length === 1 ? "remains" : "remain"} the primary contributor${overSpending.length > 1 ? "s" : ""} to year-to-date unfavorable ${reportLabelShort} variances.`);
  }

  // Underspending stations
  const underSpending = Object.entries(stationData)
    .filter(([, d]) => d.ytdActual < d.ytdBudget && d.ytdBudget > 0)
    .sort(([, a], [, b]) => (a.ytdActual - a.ytdBudget) - (b.ytdActual - b.ytdBudget));
  if (underSpending.length > 0) {
    observations.push(`${underSpending.map(([s]) => s).join(" and ")} continue producing strong favorable year-to-date budget variances.`);
  }

  observations.push(`${reportLabelShort === "PM" ? "Preventive maintenance" : "Corrective repair management"} continues serving as a key operational cost control mechanism. ${monthName} ${year} performance demonstrates strong maintenance discipline while supporting operational fleet reliability.`);

  return observations;
}
