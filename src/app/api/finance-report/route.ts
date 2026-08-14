import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireApiUser, fleetGroupWhere } from "@/lib/api";
import { PM_CATEGORIES, CR_CATEGORIES, STATIONS, STATION_LABEL } from "@/lib/constants";
import { classifyPM, classifyCR } from "@/lib/classify";

const ALL_STATIONS = STATIONS as readonly string[];

function getMonday(d: Date): Date {
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(d.getFullYear(), d.getMonth(), diff);
}

export async function GET(req: NextRequest) {
  const auth = await requireApiUser();
  if ("error" in auth) return auth.error;

  const url = new URL(req.url);
  const year = parseInt(url.searchParams.get("year") ?? String(new Date().getFullYear()));
  const month = parseInt(url.searchParams.get("month") ?? String(new Date().getMonth() + 1));
  const viewMode = url.searchParams.get("view") ?? "month";
  const weekDateParam = url.searchParams.get("weekDate") ?? "";
  const reportType = url.searchParams.get("reportType") ?? "PM";
  const prevYear = year - 1;

  const CATEGORIES = reportType === "CR" ? CR_CATEGORIES : PM_CATEGORIES;

  // Fleet grouping (Sync only): scope all work orders to the selected fleet.
  const fg = await fleetGroupWhere();
  const fleetWo: Record<string, unknown> =
    fg === "TRACTOR_TRAILER"
      ? { vehicle: { fleetGroup: "TRACTOR_TRAILER" } }
      : fg === "REGULAR"
        ? { OR: [{ vehicle: { fleetGroup: "REGULAR" } }, { vehicleId: null }] }
        : {};

  // Week boundaries (used when viewMode === "week")
  let weekStart: Date | null = null;
  let weekEnd: Date | null = null;
  if (viewMode === "week") {
    const ref = weekDateParam ? new Date(weekDateParam + "T12:00:00Z") : new Date();
    weekStart = getMonday(ref);
    weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);
    weekEnd.setHours(23, 59, 59, 999);
  }

  // Fetch budgets for the selected year
  const budgets = await prisma.pmBudget.findMany({ where: { year } });

  // Fetch completed work orders for current year up to selected month
  const startCurrent = new Date(Date.UTC(year, 0, 1));
  const endCurrent = new Date(Date.UTC(year, month, 0, 23, 59, 59));
  const woCurrent = await prisma.workOrder.findMany({
    where: {
      status: "COMPLETED",
      completedAt: { gte: startCurrent, lte: endCurrent },
      ...fleetWo,
    },
    include: { vehicle: { select: { station: true, dxNumber: true, name: true } } },
  });

  // Fetch completed work orders for previous year up to same month
  const startPrev = new Date(Date.UTC(prevYear, 0, 1));
  const endPrev = new Date(Date.UTC(prevYear, month, 0, 23, 59, 59));
  const woPrev = await prisma.workOrder.findMany({
    where: {
      status: "COMPLETED",
      completedAt: { gte: startPrev, lte: endPrev },
      ...fleetWo,
    },
    include: { vehicle: { select: { station: true, dxNumber: true, name: true } } },
  });

  const classify = reportType === "CR" ? classifyCR : classifyPM;

  // Build actuals: { station -> category -> { monthly, ytd } }
  type StationData = Record<string, { monthly: number; ytd: number }>;
  type AllData = Record<string, StationData>;

  function buildActuals(workOrders: typeof woCurrent): AllData {
    const data: AllData = {};
    for (const station of [...ALL_STATIONS, "ALL"]) {
      data[station] = {};
      for (const cat of CATEGORIES) {
        data[station][cat] = { monthly: 0, ytd: 0 };
      }
    }

    for (const wo of workOrders) {
      const cat = classify(wo.title);
      if (!cat || !(CATEGORIES as readonly string[]).includes(cat)) continue;

      // A service carries its own station (set from the upload's STATION column);
      // fall back to the vehicle's station. A service whose station is unknown /
      // non-brand still counts in the consolidated "ALL" total — only skip it
      // from a per-station bucket.
      const rawStation = (wo.station ?? wo.vehicle?.station ?? "") as string;
      const station = ALL_STATIONS.includes(rawStation) ? rawStation : null;

      const woMonth = wo.completedAt ? new Date(wo.completedAt).getMonth() + 1 : month;
      const woDate = wo.completedAt ? new Date(wo.completedAt) : null;
      const cost = wo.cost ?? 0;

      // YTD
      if (station && data[station]?.[cat]) {
        data[station][cat].ytd += cost;
      }
      if (data["ALL"]?.[cat]) {
        data["ALL"][cat].ytd += cost;
      }

      // Period (week or month)
      let inPeriod = false;
      if (viewMode === "week" && weekStart && weekEnd && woDate) {
        inPeriod = woDate >= weekStart && woDate <= weekEnd;
      } else {
        inPeriod = woMonth === month;
      }

      if (inPeriod) {
        if (station && data[station]?.[cat]) {
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
  for (const station of [...ALL_STATIONS, "ALL"]) {
    budgetData[station] = {};
    for (const cat of CATEGORIES) {
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
    // For weekly view, still use the month-level budget as the reference period
    if (b.month === month) {
      budgetData["ALL"][cat].monthly += b.amount;
    }
  }

  // Build monthly actuals for charts (all 12 months for current year)
  const woFullYear = await prisma.workOrder.findMany({
    where: {
      status: "COMPLETED",
      completedAt: { gte: new Date(year, 0, 1), lte: new Date(year, 11, 31, 23, 59, 59) },
      ...fleetWo,
    },
    include: { vehicle: { select: { station: true } } },
  });

  const woFullPrev = await prisma.workOrder.findMany({
    where: {
      status: "COMPLETED",
      completedAt: { gte: new Date(prevYear, 0, 1), lte: new Date(prevYear, 11, 31, 23, 59, 59) },
      ...fleetWo,
    },
    include: { vehicle: { select: { station: true } } },
  });

  // Build monthly totals per station (including ALL)
  const monthlyByStation: Record<string, { month: number; actual: number; prevYear: number; budget: number }[]> = {};
  for (const station of ["ALL", ...ALL_STATIONS]) {
    const totals: { month: number; actual: number; prevYear: number; budget: number }[] = [];
    for (let m = 1; m <= 12; m++) {
      let actual = 0;
      let prev = 0;
      let bud = 0;

      for (const wo of woFullYear) {
        const woMonth = wo.completedAt ? new Date(wo.completedAt).getMonth() + 1 : 0;
        const woStation = (wo.station ?? wo.vehicle?.station ?? "") as string;
        if (woMonth === m && (station === "ALL" || woStation === station)) {
          const cat = classify(wo.title);
          if (cat) actual += wo.cost ?? 0;
        }
      }

      for (const wo of woFullPrev) {
        const woMonth = wo.completedAt ? new Date(wo.completedAt).getMonth() + 1 : 0;
        const woStation = (wo.station ?? wo.vehicle?.station ?? "") as string;
        if (woMonth === m && (station === "ALL" || woStation === station)) {
          const cat = classify(wo.title);
          if (cat) prev += wo.cost ?? 0;
        }
      }

      for (const b of budgets) {
        if (b.month === m && (station === "ALL" || b.station === station)) bud += b.amount;
      }

      totals.push({ month: m, actual: Math.round(actual), prevYear: Math.round(prev), budget: Math.round(bud) });
    }
    monthlyByStation[station] = totals;
  }
  const monthlyTotals = monthlyByStation["ALL"];

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
    return CATEGORIES.map((cat) => {
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
    ALL: "All Stations - Consolidated",
    ...Object.fromEntries(ALL_STATIONS.map((s) => [s, (STATION_LABEL[s] ?? s).replace(" — ", " - ")])),
  };

  for (const station of ["ALL", ...ALL_STATIONS]) {
    stations[station] = {
      rows: buildStationRows(station),
      label: stationLabels[station] ?? station,
    };
  }

  // For CR report, include individual work order details for Mechanical Repairs & Engine Services
  type ServiceDetail = {
    title: string;
    cost: number;
    vehicle: string;
    station: string;
    vendor: string;
    date: string;
    category: string;
  };
  const serviceDetails: ServiceDetail[] = [];

  if (reportType === "CR") {
    for (const wo of woCurrent) {
      const cat = classifyCR(wo.title);
      if (!cat) continue;
      const woMonth = wo.completedAt ? new Date(wo.completedAt).getMonth() + 1 : month;
      const woDate = wo.completedAt ? new Date(wo.completedAt) : null;

      let inPeriod = false;
      if (viewMode === "week" && weekStart && weekEnd && woDate) {
        inPeriod = woDate >= weekStart && woDate <= weekEnd;
      } else {
        inPeriod = woMonth === month;
      }

      if (inPeriod && (cat === "Mechanical Repairs" || cat === "Engine Services" || cat === "Cosmetic / Utility")) {
        const v = wo.vehicle as { station?: string; dxNumber?: string; name?: string } | null;
        serviceDetails.push({
          title: wo.title,
          cost: wo.cost ?? 0,
          vehicle: v?.dxNumber ?? v?.name ?? "Unknown",
          station: (wo.station ?? v?.station ?? "—") as string,
          vendor: (wo.performedBy ?? wo.vendor ?? "") as string,
          date: wo.completedAt ? new Date(wo.completedAt).toISOString().slice(0, 10) : "",
          category: cat,
        });
      }
    }
    serviceDetails.sort((a, b) => b.cost - a.cost);
  }

  // Parts & Supplies — a separate expense category not tied to a vehicle.
  // Parts & Supplies aren't tied to a vehicle, so they can't be attributed to
  // the tractor/trailer fleet — show none when that fleet is selected.
  const partsExpenses = fg === "TRACTOR_TRAILER" ? [] : await prisma.partsExpense.findMany({
    where: { date: { gte: new Date(year, 0, 1), lte: new Date(year, 11, 31, 23, 59, 59) } },
  });
  const partsMonthly: number[] = Array(12).fill(0);
  const partsByStation: Record<string, { ytd: number; monthly: number; total: number }> = {};
  for (const s of [...ALL_STATIONS, "ALL", "Shared"]) partsByStation[s] = { ytd: 0, monthly: 0, total: 0 };
  let partsYtd = 0, partsMonth = 0, partsTotal = 0, partsParts = 0, partsSuppliesCat = 0;
  for (const e of partsExpenses) {
    const m = new Date(e.date).getMonth() + 1;
    const amt = e.amount ?? 0;
    partsMonthly[m - 1] += amt;
    partsTotal += amt;
    if (e.category === "SUPPLIES") partsSuppliesCat += amt; else partsParts += amt;
    if (m <= month) partsYtd += amt;
    if (m === month) partsMonth += amt;
    const st = ALL_STATIONS.includes((e.station ?? "") as string) ? (e.station as string) : "Shared";
    partsByStation[st].total += amt;
    partsByStation["ALL"].total += amt;
    if (m <= month) { partsByStation[st].ytd += amt; partsByStation["ALL"].ytd += amt; }
    if (m === month) { partsByStation[st].monthly += amt; partsByStation["ALL"].monthly += amt; }
  }
  const partsSupplies = {
    ytd: Math.round(partsYtd),
    monthly: Math.round(partsMonth),
    total: Math.round(partsTotal),
    parts: Math.round(partsParts),
    supplies: Math.round(partsSuppliesCat),
    monthlyTotals: partsMonthly.map((v) => Math.round(v)),
    byStation: Object.fromEntries(Object.entries(partsByStation).map(([k, v]) => [k, { ytd: Math.round(v.ytd), monthly: Math.round(v.monthly), total: Math.round(v.total) }])),
  };

  return NextResponse.json({
    year,
    month,
    prevYear,
    reportType,
    stations,
    monthlyTotals,
    monthlyByStation,
    partsSupplies,
    ...(serviceDetails.length > 0 ? { serviceDetails } : {}),
    ...(weekStart && weekEnd ? { weekStart: weekStart.toISOString(), weekEnd: weekEnd.toISOString() } : {}),
  });
}
