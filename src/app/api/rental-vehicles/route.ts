import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireApiUser, requireManager, badRequest } from "@/lib/api";
import { getUserStationFilter } from "@/lib/auth";
import { logActivity } from "@/lib/activity";

export async function GET() {
  const auth = await requireApiUser();
  if ("error" in auth) return auth.error;
  const stations = getUserStationFilter(auth.user);
  const where = stations === null ? {} : { station: { in: stations } };
  const rentals = await prisma.rentalVehicle
    .findMany({ where, orderBy: { pickupDate: "desc" } })
    .catch(() => []);
  return NextResponse.json(rentals);
}

const schema = z.object({
  vehicleName: z.string().min(1),
  rentalCompany: z.string().optional().nullable(),
  station: z.string().min(1),
  pickupDate: z.string().optional().nullable(),
  returnDate: z.string().optional().nullable(),
  amount: z.coerce.number().min(0).optional().nullable(),
  cost: z.coerce.number().min(0).optional().nullable(),
  invoiceUrls: z.array(z.string()).optional().nullable(),
  notes: z.string().optional().nullable(),
});

export async function POST(req: Request) {
  const auth = await requireManager();
  if ("error" in auth) return auth.error;
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return badRequest(parsed.error.issues[0]?.message ?? "Invalid input");
  const d = parsed.data;
  const rental = await prisma.rentalVehicle.create({
    data: {
      vehicleName: d.vehicleName,
      rentalCompany: d.rentalCompany || null,
      station: d.station,
      pickupDate: d.pickupDate ? new Date(d.pickupDate) : null,
      returnDate: d.returnDate ? new Date(d.returnDate) : null,
      amount: d.amount ?? null,
      cost: d.cost ?? null,
      invoiceUrls: d.invoiceUrls && d.invoiceUrls.length > 0 ? JSON.stringify(d.invoiceUrls) : null,
      notes: d.notes || null,
    },
  });
  await logActivity(auth.user, {
    action: "created",
    entity: "Rental Vehicle",
    entityLabel: rental.rentalCompany ? `${rental.vehicleName} (${rental.rentalCompany})` : rental.vehicleName,
    station: rental.station,
    detail: rental.cost != null ? `$${rental.cost.toFixed(2)}` : undefined,
  });
  return NextResponse.json(rental, { status: 201 });
}
