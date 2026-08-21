import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireApiUser, fleetGroupWhere, stationWhere } from "@/lib/api";
import { buildBuckets, computeMileage, SOURCE_SAMSARA, type Reading } from "@/lib/mileage";

const PERIODS = 12;

/** Miles driven per week/month, from odometer history, with the fuel and
 *  maintenance spend of the same period so cost per mile and MPG line up. */
export async function GET(req: NextRequest) {
  const auth = await requireApiUser();
  if ("error" in auth) return auth.error;

  const sp = req.nextUrl.searchParams;
  const range = sp.get("range") === "week" ? "week" : "month";
  const dateStr = sp.get("date") || new Date().toISOString().slice(0, 10);
  const ref = new Date(dateStr + "T12:00:00Z");

  const buckets = buildBuckets(range, PERIODS, ref);
  const windowStart = buckets[0].start;
  const windowEnd = buckets[buckets.length - 1].end;

  const sw = stationWhere(auth.user);
  const requestedStation = sp.get("station") || "";
  const fg = await fleetGroupWhere();
  // A station-scoped user can narrow to one of their own stations, never past them.
  const stationFilter =
    requestedStation && (!sw || sw.station.in.includes(requestedStation as never))
      ? { station: requestedStation }
      : (sw ?? {});
  const vehicleWhere: Record<string, unknown> = {
    ...stationFilter,
    ...(fg ? { fleetGroup: fg } : {}),
  };

  const vehicles = await prisma.vehicle.findMany({
    where: vehicleWhere,
    select: { id: true, name: true, dxNumber: true, station: true, odometer: true },
  });
  const vehicleIds = vehicles.map((v) => v.id);

  const [readings, fuelLogs, workOrders] = await Promise.all([
    prisma.odometerReading.findMany({
      // One reading before the window is needed to measure the first period.
      where: { vehicleId: { in: vehicleIds }, readAt: { lte: windowEnd } },
      select: { vehicleId: true, readAt: true, miles: true, source: true },
      orderBy: { readAt: "asc" },
    }),
    prisma.fuelLog.findMany({
      where: { vehicleId: { in: vehicleIds }, date: { gte: windowStart, lt: windowEnd } },
      select: { vehicleId: true, date: true, totalCost: true, liters: true },
    }),
    prisma.workOrder.findMany({
      where: {
        vehicleId: { in: vehicleIds },
        status: "COMPLETED",
        completedAt: { gte: windowStart, lt: windowEnd },
      },
      select: { vehicleId: true, completedAt: true, cost: true },
    }),
  ]);

  const byVehicleReadings = new Map<string, Reading[]>();
  for (const r of readings) {
    const arr = byVehicleReadings.get(r.vehicleId);
    const reading: Reading = { readAt: r.readAt, miles: r.miles, source: r.source };
    if (arr) arr.push(reading);
    else byVehicleReadings.set(r.vehicleId, [reading]);
  }

  const bucketIndex = (d: Date) =>
    buckets.findIndex((b) => d >= b.start && d < b.end);

  const milesByBucket = new Array(PERIODS).fill(0);
  const fuelByBucket = new Array(PERIODS).fill(0);
  const gallonsByBucket = new Array(PERIODS).fill(0);
  const maintByBucket = new Array(PERIODS).fill(0);

  for (const f of fuelLogs) {
    const i = bucketIndex(new Date(f.date));
    if (i >= 0) {
      fuelByBucket[i] += f.totalCost;
      gallonsByBucket[i] += f.liters;
    }
  }
  for (const w of workOrders) {
    if (!w.completedAt) continue;
    const i = bucketIndex(new Date(w.completedAt));
    if (i >= 0) maintByBucket[i] += w.cost;
  }

  let rejectedReadings = 0;
  let vehiclesWithData = 0;
  let vehiclesWithTelemetry = 0;
  let vehiclesUnreliable = 0;
  const perVehicle: {
    id: string;
    label: string;
    station: string | null;
    miles: number;
    fuel: number;
    maint: number;
    gallons: number;
    lastReadAt: string | null;
    lastMiles: number | null;
    /** Where the miles came from: telematics, hand-keyed records, or nothing usable. */
    source: "Samsara" | "Records" | "No data";
  }[] = [];
  const milesByStation: Record<string, number> = {};
  const selected = buckets.length - 1; // the period being reported on

  for (const v of vehicles) {
    const vReadings = byVehicleReadings.get(v.id) ?? [];
    const res = computeMileage(vReadings, buckets);
    const hasTelemetry = vReadings.filter((r) => r.source === SOURCE_SAMSARA).length >= 2;
    rejectedReadings += res.rejected;
    if (res.total > 0) vehiclesWithData++;
    if (res.unreliable) vehiclesUnreliable++;
    if (hasTelemetry) vehiclesWithTelemetry++;
    res.perBucket.forEach((m, i) => {
      milesByBucket[i] += m;
    });

    const vFuelLogs = fuelLogs.filter(
      (f) => f.vehicleId === v.id && bucketIndex(new Date(f.date)) === selected,
    );
    const vMaint = workOrders
      .filter((w) => w.vehicleId === v.id && w.completedAt && bucketIndex(new Date(w.completedAt)) === selected)
      .reduce((s, w) => s + w.cost, 0);
    const periodMiles = Math.round(res.perBucket[selected]);
    if (periodMiles > 0) {
      milesByStation[v.station ?? "Unknown"] =
        (milesByStation[v.station ?? "Unknown"] ?? 0) + periodMiles;
    }
    if (periodMiles > 0 || vFuelLogs.length > 0 || vMaint > 0) {
      perVehicle.push({
        id: v.id,
        label: v.dxNumber ?? v.name,
        station: v.station ?? null,
        miles: periodMiles,
        fuel: Math.round(vFuelLogs.reduce((s, f) => s + f.totalCost, 0) * 100) / 100,
        maint: Math.round(vMaint * 100) / 100,
        gallons: Math.round(vFuelLogs.reduce((s, f) => s + f.liters, 0) * 10) / 10,
        lastReadAt: res.lastReadAt ? res.lastReadAt.toISOString() : null,
        lastMiles: res.lastMiles,
        source: hasTelemetry ? "Samsara" : res.unreliable || res.total === 0 ? "No data" : "Records",
      });
    }
  }

  perVehicle.sort((a, b) => b.miles - a.miles);

  const trend = buckets.map((b, i) => {
    const miles = Math.round(milesByBucket[i]);
    const fuel = Math.round(fuelByBucket[i] * 100) / 100;
    const maint = Math.round(maintByBucket[i] * 100) / 100;
    const gallons = Math.round(gallonsByBucket[i] * 10) / 10;
    return {
      key: b.key,
      label: b.label,
      Miles: miles,
      fuel,
      maint,
      gallons,
      costPerMile: miles > 0 ? Math.round(((fuel + maint) / miles) * 1000) / 1000 : null,
      mpg: miles > 0 && gallons > 0 ? Math.round((miles / gallons) * 10) / 10 : null,
    };
  });

  const stationsResult = await prisma.vehicle.groupBy({ by: ["station"], orderBy: { station: "asc" } });

  const current = trend[selected];
  const previous = trend[selected - 1];

  return NextResponse.json({
    range,
    periodStart: buckets[selected].start.toISOString(),
    periodEnd: buckets[selected].end.toISOString(),
    stations: stationsResult.map((s) => s.station).filter(Boolean),
    trend,
    current,
    previous: previous ?? null,
    byStation: Object.entries(milesByStation)
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value),
    perVehicle: perVehicle.slice(0, 500),
    coverage: {
      vehicles: vehicles.length,
      vehiclesWithData,
      vehiclesWithoutReadings: vehicles.length - vehiclesWithData,
      vehiclesWithTelemetry,
      vehiclesUnreliable,
      rejectedReadings,
      readings: readings.length,
    },
  });
}
