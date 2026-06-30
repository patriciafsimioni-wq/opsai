import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireApiUser, requireManager, badRequest } from "@/lib/api";

export async function GET() {
  const auth = await requireApiUser();
  if ("error" in auth) return auth.error;
  const trips = await prisma.trip.findMany({
    orderBy: { scheduledStart: "desc" },
    include: { vehicle: true, driver: true },
  });
  return NextResponse.json(trips);
}

const schema = z.object({
  vehicleId: z.string().min(1),
  driverId: z.string().optional().nullable(),
  origin: z.string().min(1),
  destination: z.string().min(1),
  scheduledStart: z.string().min(1),
  distanceKm: z.coerce.number().min(0).optional(),
  cargo: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  status: z.enum(["SCHEDULED", "IN_PROGRESS", "COMPLETED", "CANCELLED"]).optional(),
});

export async function POST(req: Request) {
  const auth = await requireManager();
  if ("error" in auth) return auth.error;
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return badRequest(parsed.error.issues[0]?.message ?? "Invalid input");
  const d = parsed.data;
  const trip = await prisma.trip.create({
    data: {
      vehicleId: d.vehicleId,
      driverId: d.driverId || null,
      origin: d.origin,
      destination: d.destination,
      scheduledStart: new Date(d.scheduledStart),
      distanceKm: d.distanceKm ?? 0,
      cargo: d.cargo || null,
      notes: d.notes || null,
      status: d.status ?? "SCHEDULED",
    },
  });
  return NextResponse.json(trip, { status: 201 });
}
