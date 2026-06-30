import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";

export async function GET(req: NextRequest) {
  await requireUser();

  const url = new URL(req.url);
  const dateParam = url.searchParams.get("date");
  const station = url.searchParams.get("station");
  const range = url.searchParams.get("range") ?? "day";

  const where: Record<string, unknown> = {};

  if (dateParam) {
    const d = new Date(dateParam);
    let end: Date;

    if (range === "week") {
      const dayOfWeek = d.getDay();
      const monday = new Date(d);
      monday.setDate(d.getDate() - ((dayOfWeek + 6) % 7));
      monday.setHours(0, 0, 0, 0);
      end = new Date(monday);
      end.setDate(monday.getDate() + 7);
      where.date = { gte: monday, lt: end };
    } else if (range === "month") {
      const start = new Date(d.getFullYear(), d.getMonth(), 1);
      end = new Date(d.getFullYear(), d.getMonth() + 1, 1);
      where.date = { gte: start, lt: end };
    } else {
      const next = new Date(d);
      next.setDate(next.getDate() + 1);
      where.date = { gte: d, lt: next };
    }
  }

  if (station) {
    where.station = station;
  }

  const routes = await prisma.fareyeRoute.findMany({
    where,
    orderBy: [{ date: "desc" }, { routeId: "asc" }],
  });

  // Compute summary stats
  const totalMiles = routes.reduce((s, r) => s + r.miles, 0);
  const totalStops = routes.reduce((s, r) => s + r.stops, 0);
  const avgUtil = routes.length > 0
    ? routes.reduce((s, r) => s + r.vehicleUtilization, 0) / routes.length
    : 0;
  const avgSporh = routes.length > 0
    ? routes.reduce((s, r) => s + r.sporh, 0) / routes.length
    : 0;
  const totalPlannedHrs = routes.reduce((s, r) => s + r.plannedHours, 0);

  // Group by vehicleType for breakdown
  const byType: Record<string, { count: number; miles: number; stops: number; avgUtil: number }> = {};
  for (const r of routes) {
    if (!byType[r.vehicleType]) {
      byType[r.vehicleType] = { count: 0, miles: 0, stops: 0, avgUtil: 0 };
    }
    byType[r.vehicleType].count++;
    byType[r.vehicleType].miles += r.miles;
    byType[r.vehicleType].stops += r.stops;
    byType[r.vehicleType].avgUtil += r.vehicleUtilization;
  }
  for (const key of Object.keys(byType)) {
    byType[key].avgUtil = Math.round((byType[key].avgUtil / byType[key].count) * 100) / 100;
    byType[key].miles = Math.round(byType[key].miles * 100) / 100;
  }

  // Group by station for station breakdown
  const byStation: Record<string, { count: number; miles: number; stops: number; avgUtil: number }> = {};
  for (const r of routes) {
    if (!byStation[r.station]) {
      byStation[r.station] = { count: 0, miles: 0, stops: 0, avgUtil: 0 };
    }
    byStation[r.station].count++;
    byStation[r.station].miles += r.miles;
    byStation[r.station].stops += r.stops;
    byStation[r.station].avgUtil += r.vehicleUtilization;
  }
  for (const key of Object.keys(byStation)) {
    byStation[key].avgUtil = Math.round((byStation[key].avgUtil / byStation[key].count) * 100) / 100;
    byStation[key].miles = Math.round(byStation[key].miles * 100) / 100;
  }

  // Group by date for daily breakdown (useful for week/month views)
  const byDate: Record<string, { count: number; miles: number; stops: number; avgUtil: number }> = {};
  for (const r of routes) {
    const dateKey = new Date(r.date).toISOString().slice(0, 10);
    if (!byDate[dateKey]) {
      byDate[dateKey] = { count: 0, miles: 0, stops: 0, avgUtil: 0 };
    }
    byDate[dateKey].count++;
    byDate[dateKey].miles += r.miles;
    byDate[dateKey].stops += r.stops;
    byDate[dateKey].avgUtil += r.vehicleUtilization;
  }
  for (const key of Object.keys(byDate)) {
    byDate[key].avgUtil = Math.round((byDate[key].avgUtil / byDate[key].count) * 100) / 100;
    byDate[key].miles = Math.round(byDate[key].miles * 100) / 100;
  }

  // Get available dates for date picker
  const dates = await prisma.fareyeRoute.findMany({
    select: { date: true },
    distinct: ["date"],
    orderBy: { date: "desc" },
  });
  const availableDates = dates.map((d) => d.date.toISOString().slice(0, 10));

  // Get available stations that have data
  const stations = await prisma.fareyeRoute.findMany({
    select: { station: true },
    distinct: ["station"],
    orderBy: { station: "asc" },
  });
  const availableStations = stations.map((s) => s.station);

  return NextResponse.json({
    routes,
    summary: {
      totalRoutes: routes.length,
      totalMiles: Math.round(totalMiles * 100) / 100,
      totalStops,
      avgUtilization: Math.round(avgUtil * 100) / 100,
      avgSporh: Math.round(avgSporh * 100) / 100,
      totalPlannedHrs: Math.round(totalPlannedHrs * 100) / 100,
    },
    byType,
    byStation,
    byDate,
    availableDates,
    availableStations,
  });
}
