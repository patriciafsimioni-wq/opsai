import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

function getMonday(d: Date): Date {
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(d.getFullYear(), d.getMonth(), diff);
}

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const station = sp.get("station") || "";
  const range = sp.get("range") || "month"; // week | month
  const dateStr = sp.get("date") || new Date().toISOString().slice(0, 10);

  const refDate = new Date(dateStr + "T12:00:00Z");

  // Compute date window
  let dateStart: Date;
  let dateEnd: Date;
  if (range === "week") {
    dateStart = getMonday(refDate);
    dateEnd = new Date(dateStart);
    dateEnd.setDate(dateEnd.getDate() + 6);
    dateEnd.setHours(23, 59, 59, 999);
  } else {
    dateStart = new Date(Date.UTC(refDate.getUTCFullYear(), refDate.getUTCMonth(), 1));
    dateEnd = new Date(Date.UTC(refDate.getUTCFullYear(), refDate.getUTCMonth() + 1, 0, 23, 59, 59, 999));
  }

  // Vehicle filter by station
  const vehicleWhere: Record<string, unknown> = station ? { station } : {};
  const vehicleIds = station
    ? (await prisma.vehicle.findMany({ where: vehicleWhere, select: { id: true } })).map((v) => v.id)
    : [];

  const fuelWhere: Record<string, unknown> = {
    date: { gte: dateStart, lte: dateEnd },
  };
  if (station) fuelWhere.vehicleId = { in: vehicleIds };

  const woWhere: Record<string, unknown> = {
    status: "COMPLETED",
    completedAt: { gte: dateStart, lte: dateEnd },
  };
  if (station) woWhere.vehicleId = { in: vehicleIds };

  // Get all data
  const [vehicles, fuelLogs, workOrders, allFuelLogs, allWorkOrders] = await Promise.all([
    prisma.vehicle.findMany({ where: vehicleWhere, include: { assignedDriver: true } }),
    prisma.fuelLog.findMany({ where: fuelWhere, include: { vehicle: true } }),
    prisma.workOrder.findMany({ where: woWhere, include: { vehicle: true, service: true } }),
    // For trend data, get last 6 months regardless of current filter window
    prisma.fuelLog.findMany({
      where: station ? { vehicleId: { in: vehicleIds } } : {},
      include: { vehicle: true },
    }),
    prisma.workOrder.findMany({
      where: {
        status: "COMPLETED",
        ...(station ? { vehicleId: { in: vehicleIds } } : {}),
      },
      include: { vehicle: true, service: true },
    }),
  ]);

  // Get available stations
  const stationsResult = await prisma.vehicle.groupBy({ by: ["station"], orderBy: { station: "asc" } });
  const stations = stationsResult.map((s) => s.station).filter(Boolean).sort() as string[];

  // Period stats
  const totalFuel = fuelLogs.reduce((s, f) => s + f.totalCost, 0);
  const totalMaint = workOrders.reduce((s, w) => s + w.cost, 0);
  const totalVolume = fuelLogs.reduce((s, f) => s + f.liters, 0);
  const fillUps = fuelLogs.length;
  const completedWOs = workOrders.length;

  // Fleet summary
  const totalVehicles = vehicles.length;
  const activeVehicles = vehicles.filter((v) => v.status === "ACTIVE").length;
  const avgMileage = totalVehicles > 0
    ? Math.round(vehicles.reduce((s, v) => s + v.odometer, 0) / totalVehicles)
    : 0;

  // 6-month trend
  const now = new Date();
  const monthLabels: string[] = [];
  const months: { y: number; m: number }[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    monthLabels.push(d.toLocaleDateString("en-US", { month: "short" }));
    months.push({ y: d.getFullYear(), m: d.getMonth() });
  }

  function bucket(date: Date) {
    return months.findIndex((mm) => mm.y === date.getFullYear() && mm.m === date.getMonth());
  }

  const fuelByMonth = new Array(6).fill(0);
  const maintByMonth = new Array(6).fill(0);
  const fuelVolumeByMonth = new Array(6).fill(0);
  const fillUpsByMonth = new Array(6).fill(0);
  for (const f of allFuelLogs) {
    const b = bucket(new Date(f.date));
    if (b >= 0) {
      fuelByMonth[b] += f.totalCost;
      fuelVolumeByMonth[b] += f.liters;
      fillUpsByMonth[b] += 1;
    }
  }
  for (const w of allWorkOrders) {
    if (!w.completedAt) continue;
    const b = bucket(new Date(w.completedAt));
    if (b >= 0) maintByMonth[b] += w.cost;
  }

  const costTrend = monthLabels.map((label, i) => ({
    label,
    Fuel: Math.round(fuelByMonth[i]),
    Maintenance: Math.round(maintByMonth[i]),
    Total: Math.round(fuelByMonth[i] + maintByMonth[i]),
  }));

  const fuelTrend = monthLabels.map((label, i) => ({
    label,
    spend: Math.round(fuelByMonth[i]),
    volume: Math.round(fuelVolumeByMonth[i]),
    fillUps: fillUpsByMonth[i],
  }));

  // Vehicles by status
  const statusCounts: Record<string, number> = {};
  for (const v of vehicles) statusCounts[v.status] = (statusCounts[v.status] ?? 0) + 1;

  // Vehicles by type
  const typeCounts: Record<string, number> = {};
  for (const v of vehicles) typeCounts[v.type] = (typeCounts[v.type] ?? 0) + 1;

  // Cost per vehicle top 10 (in selected period)
  const costPerVehicle = vehicles
    .map((v) => {
      const fuel = fuelLogs
        .filter((f) => f.vehicleId === v.id)
        .reduce((s, f) => s + f.totalCost, 0);
      const maint = workOrders
        .filter((w) => w.vehicleId === v.id)
        .reduce((s, w) => s + w.cost, 0);
      return { label: v.name, fuel: Math.round(fuel), maint: Math.round(maint), value: Math.round(fuel + maint) };
    })
    .sort((a, b) => b.value - a.value)
    .slice(0, 10);

  // Fuel spend by station (in period)
  const fuelByStation: Record<string, number> = {};
  for (const f of fuelLogs) {
    const st = f.vehicle.station ?? "Unknown";
    fuelByStation[st] = (fuelByStation[st] ?? 0) + f.totalCost;
  }
  const fuelStationData = Object.entries(fuelByStation)
    .map(([label, value]) => ({ label, value: Math.round(value) }))
    .sort((a, b) => b.value - a.value);

  // Maintenance by service type (in period)
  const maintByService: Record<string, number> = {};
  for (const w of workOrders) {
    const svc = w.service?.name ?? w.title ?? "Other";
    maintByService[svc] = (maintByService[svc] ?? 0) + w.cost;
  }
  const maintServiceData = Object.entries(maintByService)
    .map(([label, value]) => ({ label, value: Math.round(value) }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 10);

  // Avg fuel price/L trend
  const avgPriceTrend = monthLabels.map((label, i) => ({
    label,
    value: fuelVolumeByMonth[i] > 0
      ? Math.round((fuelByMonth[i] / fuelVolumeByMonth[i]) * 100) / 100
      : 0,
  }));

  // Mileage distribution (vehicle odometer ranges)
  const mileageRanges = [
    { label: "0-25K", min: 0, max: 25000 },
    { label: "25-50K", min: 25000, max: 50000 },
    { label: "50-75K", min: 50000, max: 75000 },
    { label: "75-100K", min: 75000, max: 100000 },
    { label: "100K+", min: 100000, max: Infinity },
  ];
  const mileageDist = mileageRanges.map((r) => ({
    label: r.label,
    value: vehicles.filter((v) => v.odometer >= r.min && v.odometer < r.max).length,
  }));

  return NextResponse.json({
    stations,
    dateStart: dateStart.toISOString(),
    dateEnd: dateEnd.toISOString(),
    stats: {
      totalFuel,
      totalMaint,
      totalVolume,
      fillUps,
      completedWOs,
      totalVehicles,
      activeVehicles,
      avgMileage,
      totalCost: totalFuel + totalMaint,
    },
    costTrend,
    fuelTrend,
    avgPriceTrend,
    statusCounts,
    typeCounts,
    costPerVehicle,
    fuelStationData,
    maintServiceData,
    mileageDist,
  });
}
