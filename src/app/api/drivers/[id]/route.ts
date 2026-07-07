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
  const driver = await prisma.driver.findUnique({
    where: { id },
    include: { vehicles: true, trips: { orderBy: { scheduledStart: "desc" }, take: 10 } },
  });
  if (!driver) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(driver);
}

const schema = z.object({
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  email: z.string().email().optional(),
  phone: z.string().optional().nullable(),
  licenseNumber: z.string().min(1).optional(),
  licenseClass: z.string().optional().nullable(),
  licenseExpiry: z.string().optional(),
  status: z.enum(["ACTIVE", "ON_TRIP", "OFF_DUTY", "INACTIVE"]).optional(),
  rating: z.coerce.number().min(0).max(5).optional(),
  safetyScore: z.coerce.number().min(0).max(100).optional(),
  vehicleType: z.enum(["CARGO_VAN", "BOX_TRUCK", "TRACTOR_TRUCK"]).optional().nullable(),
  medicalCardExpiry: z.string().optional().nullable(),
  mvrCheckedAt: z.string().optional().nullable(),
  drugTestStatus: z.enum(["PASS", "PENDING", "FAIL"]).optional().nullable(),
  annualReviewAt: z.string().optional().nullable(),
});

const toDateOrUndef = (v: string | null | undefined) =>
  v === undefined ? undefined : v ? new Date(v) : null;

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
  const driver = await prisma.driver.update({
    where: { id },
    data: {
      ...d,
      email: d.email ? d.email.toLowerCase() : undefined,
      phone: d.phone === undefined ? undefined : d.phone || null,
      licenseClass: d.licenseClass === undefined ? undefined : d.licenseClass || null,
      licenseExpiry: d.licenseExpiry ? new Date(d.licenseExpiry) : undefined,
      medicalCardExpiry: toDateOrUndef(d.medicalCardExpiry),
      mvrCheckedAt: toDateOrUndef(d.mvrCheckedAt),
      annualReviewAt: toDateOrUndef(d.annualReviewAt),
      drugTestStatus: d.drugTestStatus === undefined ? undefined : d.drugTestStatus || null,
    },
  });
  return NextResponse.json(driver);
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireManager();
  if ("error" in auth) return auth.error;
  const { id } = await params;
  await prisma.vehicle.updateMany({
    where: { assignedDriverId: id },
    data: { assignedDriverId: null },
  });
  await prisma.driver.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
