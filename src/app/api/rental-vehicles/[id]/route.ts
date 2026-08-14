import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireManager, badRequest } from "@/lib/api";
import { logActivity } from "@/lib/activity";

const invoiceSchema = z.object({
  amount: z.coerce.number().min(0).optional().nullable(),
  url: z.string().optional().nullable(),
  note: z.string().optional().nullable(),
});

const schema = z.object({
  vehicleName: z.string().min(1).optional(),
  rentalCompany: z.string().optional().nullable(),
  station: z.string().min(1).optional(),
  status: z.enum(["ACTIVE", "RETURNED"]).optional(),
  pickupDate: z.string().optional().nullable(),
  returnDate: z.string().optional().nullable(),
  invoices: z.array(invoiceSchema).optional().nullable(),
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
  const invoices = d.invoices === undefined
    ? undefined
    : (d.invoices ?? []).map((i) => ({ amount: i.amount ?? null, url: i.url || null, note: i.note || null }));
  const rental = await prisma.rentalVehicle.update({
    where: { id },
    data: {
      vehicleName: d.vehicleName,
      rentalCompany: d.rentalCompany === undefined ? undefined : d.rentalCompany || null,
      station: d.station,
      status: d.status,
      pickupDate: d.pickupDate === undefined ? undefined : d.pickupDate ? new Date(d.pickupDate) : null,
      returnDate: d.returnDate === undefined ? undefined : d.returnDate ? new Date(d.returnDate) : null,
      cost: invoices === undefined ? undefined : invoices.length > 0 ? invoices.reduce((s, i) => s + (i.amount ?? 0), 0) : null,
      invoices: invoices === undefined ? undefined : invoices.length > 0 ? JSON.stringify(invoices) : null,
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
