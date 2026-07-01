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
  make: z.string().min(1).optional(),
  model: z.string().min(1).optional(),
  year: z.coerce.number().int().optional(),
  vin: z.string().min(1).optional(),
  licensePlate: z.string().min(1).optional(),
  type: z.enum(["TRUCK", "VAN", "CAR", "BUS", "PICKUP", "TRAILER"]).optional(),
  status: z.enum(["ACTIVE", "IDLE", "MAINTENANCE", "OUT_OF_SERVICE"]).optional(),
  fuelType: z.enum(["DIESEL", "GASOLINE", "ELECTRIC", "HYBRID", "CNG"]).optional(),
  odometer: z.coerce.number().min(0).optional(),
  fuelLevel: z.coerce.number().min(0).max(100).optional(),
  tankCapacity: z.coerce.number().min(0).optional(),
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

  const { assignedDriverId, registrationExpiry, insuranceExpiry, offboardedDate, onboardedDate, ...rest } = d;
  const vehicle = await prisma.vehicle.update({
    where: { id },
    data: {
      ...rest,
      assignedDriverId:
        assignedDriverId === undefined ? undefined : assignedDriverId || null,
      registrationExpiry:
        registrationExpiry === undefined
          ? undefined
          : registrationExpiry
            ? new Date(registrationExpiry)
            : null,
      insuranceExpiry:
        insuranceExpiry === undefined
          ? undefined
          : insuranceExpiry
            ? new Date(insuranceExpiry)
            : null,
      offboardedDate:
        offboardedDate === undefined
          ? undefined
          : offboardedDate
            ? new Date(offboardedDate)
            : null,
      onboardedDate:
        onboardedDate === undefined
          ? undefined
          : onboardedDate
            ? new Date(onboardedDate)
            : null,
    },
  });
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
