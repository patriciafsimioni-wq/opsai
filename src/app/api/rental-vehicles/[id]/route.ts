import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireManager, badRequest } from "@/lib/api";
import { logActivity } from "@/lib/activity";

const schema = z.object({
  vehicleName: z.string().min(1).optional(),
  rentalCompany: z.string().optional().nullable(),
  station: z.string().min(1).optional(),
  pickupDate: z.string().optional().nullable(),
  returnDate: z.string().optional().nullable(),
  cost: z.coerce.number().min(0).optional().nullable(),
  invoiceUrls: z.array(z.string()).optional().nullable(),
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
  const rental = await prisma.rentalVehicle.update({
    where: { id },
    data: {
      vehicleName: d.vehicleName,
      rentalCompany: d.rentalCompany === undefined ? undefined : d.rentalCompany || null,
      station: d.station,
      pickupDate: d.pickupDate === undefined ? undefined : d.pickupDate ? new Date(d.pickupDate) : null,
      returnDate: d.returnDate === undefined ? undefined : d.returnDate ? new Date(d.returnDate) : null,
      cost: d.cost === undefined ? undefined : d.cost ?? null,
      invoiceUrls: d.invoiceUrls === undefined ? undefined : d.invoiceUrls && d.invoiceUrls.length > 0 ? JSON.stringify(d.invoiceUrls) : null,
      notes: d.notes === undefined ? undefined : d.notes || null,
    },
  });
  await logActivity(auth.user, {
    action: "updated",
    entity: "Rental Vehicle",
    entityLabel: rental.rentalCompany ? `${rental.vehicleName} (${rental.rentalCompany})` : rental.vehicleName,
    station: rental.station,
  });
  return NextResponse.json(rental);
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireManager();
  if ("error" in auth) return auth.error;
  const { id } = await params;
  const existing = await prisma.rentalVehicle.findUnique({
    where: { id },
    select: { vehicleName: true, rentalCompany: true, station: true },
  });
  await prisma.rentalVehicle.delete({ where: { id } });
  await logActivity(auth.user, {
    action: "deleted",
    entity: "Rental Vehicle",
    entityLabel: existing
      ? existing.rentalCompany
        ? `${existing.vehicleName} (${existing.rentalCompany})`
        : existing.vehicleName
      : id,
    station: existing?.station ?? null,
  });
  return NextResponse.json({ ok: true });
}
