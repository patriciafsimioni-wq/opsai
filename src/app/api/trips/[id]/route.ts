import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireManager, badRequest } from "@/lib/api";

const schema = z.object({
  status: z.enum(["SCHEDULED", "IN_PROGRESS", "COMPLETED", "CANCELLED"]).optional(),
  vehicleId: z.string().optional(),
  driverId: z.string().optional().nullable(),
  origin: z.string().min(1).optional(),
  destination: z.string().min(1).optional(),
  scheduledStart: z.string().optional(),
  distanceKm: z.coerce.number().optional(),
  cargo: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireManager();
  if ("error" in auth) return auth.error;
  const { id } = await params;
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return badRequest(parsed.error.issues[0]?.message ?? "Invalid input");
  const d = parsed.data;
  const trip = await prisma.trip.update({
    where: { id },
    data: {
      status: d.status,
      vehicleId: d.vehicleId,
      driverId: d.driverId === undefined ? undefined : d.driverId || null,
      origin: d.origin,
      destination: d.destination,
      scheduledStart: d.scheduledStart ? new Date(d.scheduledStart) : undefined,
      distanceKm: d.distanceKm,
      cargo: d.cargo,
      notes: d.notes,
      startedAt: d.status === "IN_PROGRESS" ? new Date() : undefined,
      endedAt: d.status === "COMPLETED" ? new Date() : undefined,
    },
  });
  return NextResponse.json(trip);
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireManager();
  if ("error" in auth) return auth.error;
  const { id } = await params;
  await prisma.trip.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
