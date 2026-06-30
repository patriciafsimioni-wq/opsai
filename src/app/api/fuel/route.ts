import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireApiUser, requireManager, badRequest } from "@/lib/api";

function getMonday(d: Date): Date {
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(d.getFullYear(), d.getMonth(), diff);
}

export async function GET(req: NextRequest) {
  const auth = await requireApiUser();
  if ("error" in auth) return auth.error;

  const url = new URL(req.url);
  const station = url.searchParams.get("station") ?? "";
  const range = url.searchParams.get("range") ?? "month";
  const dateParam = url.searchParams.get("date") ?? "";

  const ref = dateParam ? new Date(dateParam) : new Date();

  let dateStart: Date;
  let dateEnd: Date;

  if (range === "week") {
    dateStart = getMonday(ref);
    dateEnd = new Date(dateStart);
    dateEnd.setDate(dateEnd.getDate() + 6);
    dateEnd.setHours(23, 59, 59, 999);
  } else {
    dateStart = new Date(ref.getFullYear(), ref.getMonth(), 1);
    dateEnd = new Date(ref.getFullYear(), ref.getMonth() + 1, 0, 23, 59, 59, 999);
  }

  const purchaseType = url.searchParams.get("purchaseType") ?? "";

  const where: Record<string, unknown> = {
    date: { gte: dateStart, lte: dateEnd },
  };
  if (station) {
    where.vehicle = { station };
  }
  if (purchaseType) {
    where.purchaseType = purchaseType;
  }

  const logs = await prisma.fuelLog.findMany({
    orderBy: { date: "desc" },
    include: { vehicle: true, driver: true },
    where,
  });

  // Also return available stations for the filter dropdown
  const stationCounts = await prisma.vehicle.groupBy({
    by: ["station"],
    _count: true,
    orderBy: { station: "asc" },
  });

  // Breakdown by purchase type (always unfiltered by purchaseType)
  const typeWhere: Record<string, unknown> = {
    date: { gte: dateStart, lte: dateEnd },
  };
  if (station) {
    typeWhere.vehicle = { station };
  }
  const typeCounts = await prisma.fuelLog.groupBy({
    by: ["purchaseType"],
    where: typeWhere,
    _count: true,
    _sum: { totalCost: true, liters: true },
  });
  const purchaseBreakdown = typeCounts.map((t) => ({
    type: t.purchaseType,
    count: t._count,
    totalCost: Math.round((t._sum.totalCost ?? 0) * 100) / 100,
    totalLiters: Math.round((t._sum.liters ?? 0) * 100) / 100,
  }));

  return NextResponse.json({
    logs,
    stations: stationCounts.map((s) => s.station),
    dateStart: dateStart.toISOString(),
    dateEnd: dateEnd.toISOString(),
    purchaseBreakdown,
  });
}

const schema = z.object({
  vehicleId: z.string().min(1),
  driverId: z.string().optional().nullable(),
  date: z.string().min(1),
  liters: z.coerce.number().min(0),
  pricePerLiter: z.coerce.number().min(0),
  odometer: z.coerce.number().min(0).optional().nullable(),
  location: z.string().optional().nullable(),
  purchaseType: z.enum(["UNLEADED", "DIESEL", "DEF", "NON_FUEL"]).optional(),
});

export async function POST(req: Request) {
  const auth = await requireManager();
  if ("error" in auth) return auth.error;
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return badRequest(parsed.error.issues[0]?.message ?? "Invalid input");
  const d = parsed.data;
  const log = await prisma.fuelLog.create({
    data: {
      vehicleId: d.vehicleId,
      driverId: d.driverId || null,
      date: new Date(d.date),
      liters: d.liters,
      pricePerLiter: d.pricePerLiter,
      totalCost: Math.round(d.liters * d.pricePerLiter * 100) / 100,
      odometer: d.odometer ?? null,
      location: d.location || null,
      purchaseType: d.purchaseType ?? "DIESEL",
    },
  });
  return NextResponse.json(log, { status: 201 });
}
