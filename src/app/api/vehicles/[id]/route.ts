import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireApiUser, requireManager, badRequest } from "@/lib/api";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireApiUser();
  if ("error" in auth) return auth.error;
  const { id } = await params;
  const vehicle = await prisma.vehicle.findUnique({
    where: { id },
    include: { assignedDriver: true },
  });
  if (!vehicle) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(vehicle);
}

const patchSchema = z.object({
  name: z.string().min(1).optional(),
  dxNumber: z.string().optional().nullable(),
  make: z.string().min(1).optional(),
  model: z.string().min(1).optional(),
  year: z.coerce.number().int().optional(),
  vin: z.string().min(1).optional(),
  licensePlate: z.string().optional().nullable(),
  type: z.enum(["TRUCK", "VAN", "CAR", "BUS", "PICKUP", "TRAILER"]).optional(),
  status: z.enum(["ACTIVE", "IDLE", "MAINTENANCE", "OUT_OF_SERVICE"]).optional(),
  station: z.enum(["IAH", "AUS", "HRL", "LRD", "ACT", "CLL", "BPT"]).optional(),
  fuelType: z.enum(["DIESEL", "GASOLINE", "ELECTRIC", "HYBRID", "CNG"]).optional(),
  odometer: z.coerce.number().min(0).optional(),
  fuelLevel: z.coerce.number().min(0).max(100).optional(),
  tankCapacity: z.coerce.number().min(0).optional(),
  leasingCompany: z.string().optional().nullable(),
  leaseEndDate: z.string().optional().nullable(),
  registrationMonth: z.string().optional().nullable(),
  assignedDriverId: z.string().optional().nullable(),
  registrationExpiry: z.string().optional().nullable(),
  insuranceExpiry: z.string().optional().nullable(),
  branding: z.enum(["YELLOW_DHL", "WHITE"]).optional().nullable(),
  offboardReason: z.string().optional().nullable(),
  offboardedDate: z.string().optional().nullable(),
  onboardPhotos: z.string().optional().nullable(),
  onboardedDate: z.string().optional().nullable(),
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireApiUser();
  if ("error" in auth) return auth.error;
  const { id } = await params;
  const body = await req.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return badRequest(parsed.error.issues[0]?.message ?? "Invalid input");
  const d = parsed.data;

  const { assignedDriverId, registrationExpiry, insuranceExpiry, offboardedDate, onboardedDate, leaseEndDate, ...rest } = d;

  const toDate = (val: string | null | undefined) =>
    val === undefined ? undefined : val ? new Date(val) : null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data: Record<string, any> = {
    ...rest,
    registrationExpiry: toDate(registrationExpiry),
    insuranceExpiry: toDate(insuranceExpiry),
    offboardedDate: toDate(offboardedDate),
    onboardedDate: toDate(onboardedDate),
    leaseEndDate: toDate(leaseEndDate),
  };
  if (assignedDriverId !== undefined) {
    data.assignedDriverId = assignedDriverId || null;
  }

  const vehicle = await prisma.vehicle.update({ where: { id }, data });
  return NextResponse.json(vehicle);
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireManager();
  if ("error" in auth) return auth.error;
  const { id } = await params;
  await prisma.vehicle.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
