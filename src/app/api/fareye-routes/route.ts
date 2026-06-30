import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";

export async function GET(req: NextRequest) {
  await requireUser();

  const url = new URL(req.url);
  const dateParam = url.searchParams.get("date");
  const station = url.searchParams.get("station");

  const where: Record<string, unknown> = {};
  if (dateParam) {
    const d = new Date(dateParam);
    const next = new Date(d);
    next.setDate(next.getDate() + 1);
    where.date = { gte: d, lt: next };
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

  // Get available dates for date picker
  const dates = await prisma.fareyeRoute.findMany({
    select: { date: true },
    distinct: ["date"],
    orderBy: { date: "desc" },
  });
  const availableDates = dates.map((d) => d.date.toISOString().slice(0, 10));

  return NextResponse.json({
    routes,
    summary: {
      totalRoutes: routes.length,
      totalMiles: Math.round(totalMiles * 100) / 100,
      totalStops,
      avgUtilization: Math.round(avgUtil * 100) / 100,
      avgSporh: Math.round(avgSporh * 100) / 100,
    },
    byType,
    availableDates,
  });
}
