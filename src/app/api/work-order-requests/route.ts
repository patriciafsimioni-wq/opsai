import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireApiUser, badRequest } from "@/lib/api";

const userSelect = { id: true, name: true, email: true, role: true } as const;

export async function GET() {
  const auth = await requireApiUser();
  if ("error" in auth) return auth.error;
  const requests = await prisma.workOrderRequest.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      vehicle: true,
      service: true,
      requestedBy: { select: userSelect },
      reviewedBy: { select: userSelect },
    },
  });
  return NextResponse.json(requests);
}

const schema = z.object({
  station: z.enum(["AUS", "ACT", "IAH", "CLL", "BPT", "HRL", "LRD"]),
  vehicleId: z.string().optional().nullable(),
  vehicleOther: z.string().optional().nullable(),
  odometer: z.coerce.number().min(0).optional().nullable(),
  serviceId: z.string().min(1),
  partsNeeded: z.string().optional().nullable(),
  requestedDate: z.string().optional().nullable(),
  expectedCompletion: z.string().optional().nullable(),
  comments: z.string().optional().nullable(),
  photoUrl: z.string().optional().nullable(),
  serviceHours: z.coerce.number().min(0).optional().nullable(),
  vendorEstimate: z.coerce.number().min(0).optional().nullable(),
});

export async function POST(req: Request) {
  const auth = await requireApiUser();
  if ("error" in auth) return auth.error;
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return badRequest(parsed.error.issues[0]?.message ?? "Invalid input");
  const d = parsed.data;
  const record = await prisma.workOrderRequest.create({
    data: {
      station: d.station,
      vehicleId: d.vehicleId || null,
      vehicleOther: d.vehicleOther || null,
      odometer: d.odometer ?? null,
      serviceId: d.serviceId,
      partsNeeded: d.partsNeeded || null,
      requestedDate: d.requestedDate ? new Date(d.requestedDate) : null,
      expectedCompletion: d.expectedCompletion ? new Date(d.expectedCompletion) : null,
      comments: d.comments || null,
      photoUrl: d.photoUrl || null,
      serviceHours: d.serviceHours ?? null,
      vendorEstimate: d.vendorEstimate ?? null,
      requestedById: auth.user.id,
    },
    include: {
      vehicle: true,
      service: true,
      requestedBy: { select: userSelect },
      reviewedBy: { select: userSelect },
    },
  });
  return NextResponse.json(record, { status: 201 });
}
