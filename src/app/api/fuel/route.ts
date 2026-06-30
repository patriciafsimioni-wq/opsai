import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireApiUser, requireManager, badRequest } from "@/lib/api";

export async function GET() {
  const auth = await requireApiUser();
  if ("error" in auth) return auth.error;
  const logs = await prisma.fuelLog.findMany({
    orderBy: { date: "desc" },
    include: { vehicle: true, driver: true },
    take: 200,
  });
  return NextResponse.json(logs);
}

const schema = z.object({
  vehicleId: z.string().min(1),
  driverId: z.string().optional().nullable(),
  date: z.string().min(1),
  liters: z.coerce.number().min(0),
  pricePerLiter: z.coerce.number().min(0),
  odometer: z.coerce.number().min(0).optional().nullable(),
  location: z.string().optional().nullable(),
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
    },
  });
  return NextResponse.json(log, { status: 201 });
}
