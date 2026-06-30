import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireApiUser } from "@/lib/api";
import { PM_CATEGORIES, WO_TITLE_TO_PM_CATEGORY, FINANCE_STATIONS } from "@/lib/constants";

export async function GET(req: NextRequest) {
  const auth = await requireApiUser();
  if ("error" in auth) return auth.error;

  const url = new URL(req.url);
  const year = parseInt(url.searchParams.get("year") ?? String(new Date().getFullYear()));
  const month = parseInt(url.searchParams.get("month") ?? String(new Date().getMonth() + 1));
  const prevYear = year - 1;

  // Fetch budgets for the selected year
  const budgets = await prisma.pmBudget.findMany({ where: { year } });

  // Fetch completed work orders for current year up to selected month
  const startCurrent = new Date(year, 0, 1);
  const endCurrent = new Date(year, month, 0, 23, 59, 59);
  const woCurrent = await prisma.workOrder.findMany({
    where: {
      status: "COMPLETED",
      completedAt: { gte: startCurrent, lte: endCurrent },
    },
    include: { vehicle: { select: { station: true } } },
  });

  // Fetch completed work orders for previous year up to same month
  const startPrev = new Date(prevYear, 0, 1);
  const endPrev = new Date(prevYear, month, 0, 23, 59, 59);
  const woPrev = await prisma.workOrder.findMany({
    where: {
      status: "COMPLETED",
      completedAt: { gte: startPrev, lte: endPrev },
    },
    include: { vehicle: { select: { station: true } } },
  });

  // Helper: classify WO title to PM category
  function classify(title: string): string | null {
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

  // Build actuals: { station -> category -> { monthly, ytd } }
  type StationData = Record<string, { monthly: number; ytd: number }>;
  type AllData = Record<string, StationData>;

  function buildActuals(workOrders: typeof woCurrent): AllData {
    const data: AllData = {};
    for (const station of [...FINANCE_STATIONS, "ALL"]) {
      data[station] = {};
      for (const cat of PM_CATEGORIES) {
        data[station][cat] = { monthly: 0, ytd: 0 };
      }
    }

    for (const wo of workOrders) {
      const station = wo.vehicle?.station ?? "IAH";
      const cat = classify(wo.title);
      if (!cat || !FINANCE_STATIONS.includes(station as typeof FINANCE_STATIONS[number])) continue;

      const woMonth = wo.completedAt ? new Date(wo.completedAt).getMonth() + 1 : month;
      const cost = wo.cost ?? 0;

      // YTD
      if (data[station]?.[cat]) {
        data[station][cat].ytd += cost;
      }
      if (data["ALL"]?.[cat]) {
        data["ALL"][cat].ytd += cost;
      }

      // Monthly (only the selected month)
      if (woMonth === month) {
        if (data[station]?.[cat]) {
          data[station][cat].monthly += cost;
        }
        if (data["ALL"]?.[cat]) {
          data["ALL"][cat].monthly += cost;
        }
      }
    }

    return data;
  }

  const actualsCurrent = buildActuals(woCurrent);
  const actualsPrev = buildActuals(woPrev);

  // Build budget data: { station -> category -> { monthly, ytd, annual } }
  type BudgetData = Record<string, Record<string, { monthly: number; ytd: number; annual: number }>>;
  const budgetData: BudgetData = {};
  for (const station of [...FINANCE_STATIONS, "ALL"]) {
    budgetData[station] = {};
    for (const cat of PM_CATEGORIES) {
      budgetData[station][cat] = { monthly: 0, ytd: 0, annual: 0 };
    }
  }

  for (const b of budgets) {
    const station = b.station;
    const cat = b.category;
    if (!budgetData[station]?.[cat]) continue;

    budgetData[station][cat].annual += b.amount;
    if (b.month <= month) {
      budgetData[station][cat].ytd += b.amount;
    }
    if (b.month === month) {
      budgetData[station][cat].monthly += b.amount;
    }

    // Roll up to ALL
    budgetData["ALL"][cat].annual += b.amount;
    if (b.month <= month) {
      budgetData["ALL"][cat].ytd += b.amount;
    }
    if (b.month === month) {
      budgetData["ALL"][cat].monthly += b.amount;
    }
  }

  // Build monthly actuals for charts (all 12 months for current year)
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

  const monthlyTotals: { month: number; actual: number; prevYear: number; budget: number }[] = [];
  for (let m = 1; m <= 12; m++) {
    let actual = 0;
    let prev = 0;
    let bud = 0;

    for (const wo of woFullYear) {
      const woMonth = wo.completedAt ? new Date(wo.completedAt).getMonth() + 1 : 0;
      if (woMonth === m) {
        const cat = classify(wo.title);
        if (cat) actual += wo.cost ?? 0;
      }
    }

    for (const wo of woFullPrev) {
      const woMonth = wo.completedAt ? new Date(wo.completedAt).getMonth() + 1 : 0;
      if (woMonth === m) {
        const cat = classify(wo.title);
        if (cat) prev += wo.cost ?? 0;
      }
    }

    for (const b of budgets) {
      if (b.month === m) bud += b.amount;
    }

    monthlyTotals.push({ month: m, actual: Math.round(actual), prevYear: Math.round(prev), budget: Math.round(bud) });
  }

  // Build response with station breakdowns
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

  function buildStationRows(station: string): CategoryRow[] {
    return PM_CATEGORIES.map((cat) => {
      const ap = actualsPrev[station]?.[cat]?.monthly ?? 0;
      const ac = actualsCurrent[station]?.[cat]?.monthly ?? 0;
      const bm = budgetData[station]?.[cat]?.monthly ?? 0;
      const ytdP = actualsPrev[station]?.[cat]?.ytd ?? 0;
      const ytdC = actualsCurrent[station]?.[cat]?.ytd ?? 0;
      const ytdB = budgetData[station]?.[cat]?.ytd ?? 0;
      const annual = budgetData[station]?.[cat]?.annual ?? 0;
      const remainder = annual - ytdC;

      return {
        category: cat,
        actualPrev: Math.round(ap),
        actualCurrent: Math.round(ac),
        yoyVariancePct: ap > 0 ? Math.round(((ac - ap) / ap) * 100) : ac > 0 ? 100 : null,
        yoyVarianceAmt: Math.round(ac - ap),
        budget: Math.round(bm),
        budgetVariancePct: bm > 0 ? Math.round(((ac - bm) / bm) * 100) : null,
        budgetVarianceAmt: Math.round(ac - bm),
        ytdPrev: Math.round(ytdP),
        ytdCurrent: Math.round(ytdC),
        ytdVarianceAmt: Math.round(ytdC - ytdP),
        ytdBudget: Math.round(ytdB),
        ytdBudgetVariancePct: ytdB > 0 ? Math.round(((ytdC - ytdB) / ytdB) * 100) : null,
        ytdBudgetVarianceAmt: Math.round(ytdC - ytdB),
        annualBudget: Math.round(annual),
        remainderAmt: Math.round(remainder),
        remainderPct: annual > 0 ? Math.round((remainder / annual) * 100) : null,
      };
    });
  }

  const stations: Record<string, { rows: CategoryRow[]; label: string }> = {};
  const stationLabels: Record<string, string> = {
    ALL: "All Stations - Consolidated TX",
    IAH: "IAH - Houston",
    AUS: "AUS - Austin",
    HRL: "HRL - Harlingen",
    LRD: "LRD - Laredo",
  };

  for (const station of ["ALL", ...FINANCE_STATIONS]) {
    stations[station] = {
      rows: buildStationRows(station),
      label: stationLabels[station] ?? station,
    };
  }

  return NextResponse.json({
    year,
    month,
    prevYear,
    stations,
    monthlyTotals,
  });
}
