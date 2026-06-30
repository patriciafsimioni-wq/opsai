import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireManager, badRequest } from "@/lib/api";

const schema = z.object({
  vehicleId: z.string().min(1),
  service: z.string().min(1),
  action: z.enum(["done", "skip"]),
  note: z.string().optional().nullable(),
});

export async function POST(req: Request) {
  const auth = await requireManager();
  if ("error" in auth) return auth.error;

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return badRequest(parsed.error.issues[0]?.message ?? "Invalid input");

  const { vehicleId, service, action, note } = parsed.data;

  // Get current vehicle odometer
  const vehicle = await prisma.vehicle.findUnique({ where: { id: vehicleId }, select: { odometer: true } });
  if (!vehicle) return badRequest("Vehicle not found");

  const dismissal = await prisma.pmAlertDismissal.upsert({
    where: { vehicleId_service: { vehicleId, service } },
    create: { vehicleId, service, action, note: note ?? null, mileageAt: vehicle.odometer },
    update: { action, note: note ?? null, mileageAt: vehicle.odometer, createdAt: new Date() },
  });

  return NextResponse.json(dismissal);
}

export async function DELETE(req: Request) {
  const auth = await requireManager();
  if ("error" in auth) return auth.error;

  const { searchParams } = new URL(req.url);
  const vehicleId = searchParams.get("vehicleId");
  const service = searchParams.get("service");
  if (!vehicleId || !service) return badRequest("vehicleId and service required");

  await prisma.pmAlertDismissal.deleteMany({ where: { vehicleId, service } });
  return NextResponse.json({ ok: true });
}
