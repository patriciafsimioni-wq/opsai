import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireManager, badRequest } from "@/lib/api";
import { logActivity } from "@/lib/activity";

const patchSchema = z.object({
  vehicleId: z.string().optional().nullable(),
  driverId: z.string().optional().nullable(),
  station: z.string().optional().nullable(),
  date: z.string().optional(),
  liters: z.coerce.number().min(0).optional(),
  pricePerLiter: z.coerce.number().min(0).optional(),
  odometer: z.coerce.number().min(0).optional().nullable(),
  location: z.string().optional().nullable(),
  transactionTime: z.string().optional().nullable(),
  purchaseType: z.enum(["UNLEADED", "DIESEL", "DEF", "NON_FUEL"]).optional(),
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireManager();
  if ("error" in auth) return auth.error;
  const { id } = await params;
  const existing = await prisma.fuelLog.findUnique({ where: { id } });
  if (!existing) return badRequest("Fuel record not found");

  const body = await req.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return badRequest(parsed.error.issues[0]?.message ?? "Invalid input");
  const d = parsed.data;

  const data: Record<string, unknown> = {};
  if (d.vehicleId !== undefined) data.vehicleId = d.vehicleId || null;
  if (d.driverId !== undefined) data.driverId = d.driverId || null;
  if (d.station !== undefined) data.station = d.station || null;
  if (d.date !== undefined) data.date = new Date(d.date);
  if (d.odometer !== undefined) data.odometer = d.odometer ?? null;
  if (d.location !== undefined) data.location = d.location || null;
  if (d.transactionTime !== undefined) data.transactionTime = d.transactionTime || null;
  if (d.purchaseType !== undefined) data.purchaseType = d.purchaseType;

  const liters = d.liters ?? existing.liters;
  const price = d.pricePerLiter ?? existing.pricePerLiter;
  if (d.liters !== undefined) data.liters = liters;
  if (d.pricePerLiter !== undefined) data.pricePerLiter = price;
  if (d.liters !== undefined || d.pricePerLiter !== undefined) {
    data.totalCost = Math.round(liters * price * 100) / 100;
  }

  const log = await prisma.fuelLog.update({
    where: { id },
    data,
    include: { vehicle: true },
  });

  await logActivity(auth.user, {
    action: "edited",
    entity: "Fuel Log",
    entityLabel: log.vehicle?.name ?? log.vehicleLabel ?? id,
    station: log.station ?? null,
  });

  return NextResponse.json(log);
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireManager();
  if ("error" in auth) return auth.error;
  const { id } = await params;
  const existing = await prisma.fuelLog.findUnique({
    where: { id },
    select: { station: true, vehicle: { select: { name: true } } },
  });
  await prisma.fuelLog.delete({ where: { id } });
  await logActivity(auth.user, {
    action: "deleted",
    entity: "Fuel Log",
    entityLabel: existing?.vehicle?.name ?? id,
    station: existing?.station ?? null,
  });
  return NextResponse.json({ ok: true });
}
