import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireApiUser, badRequest } from "@/lib/api";
import { logActivity } from "@/lib/activity";
import { PO_PREFIX, PO_START, STATIONS } from "@/lib/constants";
import type { Station } from "@prisma/client";

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
      items: { include: { service: true } },
    },
  });
  return NextResponse.json(requests);
}

const itemSchema = z.object({
  serviceId: z.string().min(1),
  partsNeeded: z.string().optional().nullable(),
  vendorEstimate: z.coerce.number().min(0).optional().nullable(),
  serviceHours: z.coerce.number().min(0).optional().nullable(),
});

const schema = z.object({
  station: z.string().refine((s) => STATIONS.includes(s), "Invalid station"),
  vehicleId: z.string().optional().nullable(),
  vehicleOther: z.string().optional().nullable(),
  odometer: z.coerce.number().min(0).optional().nullable(),
  // Legacy single-service fields remain accepted; multi-service requests send
  // an `items` array instead (one shared PO covering several services).
  serviceId: z.string().optional().nullable(),
  partsNeeded: z.string().optional().nullable(),
  requestedDate: z.string().optional().nullable(),
  expectedCompletion: z.string().optional().nullable(),
  comments: z.string().optional().nullable(),
  photoUrl: z.string().optional().nullable(),
  serviceHours: z.coerce.number().min(0).optional().nullable(),
  vendorEstimate: z.coerce.number().min(0).optional().nullable(),
  requesterEmail: z.string().email().optional().nullable(),
  items: z.array(itemSchema).optional(),
});

export async function POST(req: Request) {
  const auth = await requireApiUser();
  if ("error" in auth) return auth.error;
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return badRequest(parsed.error.issues[0]?.message ?? "Invalid input");
  const d = parsed.data;

  // Auto-generate PO number: prefix (2 letters from station) + zero-padded seq
  const prefix = PO_PREFIX[d.station] ?? d.station.slice(0, 2);
  const startSeq = PO_START[d.station] ?? 1;
  const lastPO = await prisma.workOrderRequest.findFirst({
    where: { poNumber: { startsWith: prefix } },
    orderBy: { poNumber: "desc" },
    select: { poNumber: true },
  });
  let nextSeq = startSeq;
  if (lastPO?.poNumber) {
    const numPart = parseInt(lastPO.poNumber.slice(prefix.length), 10);
    if (!isNaN(numPart) && numPart >= startSeq) nextSeq = numPart + 1;
  }
  const poNumber = `${prefix}${String(nextSeq).padStart(3, "0")}`;

  // Normalize to a list of requested service lines. A legacy single-service
  // request (just `serviceId`) becomes a one-line list; multi-service requests
  // send `items`. At least one line is required.
  const lines = d.items && d.items.length > 0
    ? d.items
    : d.serviceId
      ? [{ serviceId: d.serviceId, partsNeeded: d.partsNeeded ?? null, vendorEstimate: d.vendorEstimate ?? null, serviceHours: d.serviceHours ?? null }]
      : [];
  if (lines.length === 0) return badRequest("At least one service is required");

  const serviceIds = [...new Set(lines.map((l) => l.serviceId))];
  const services = await prisma.service.findMany({
    where: { id: { in: serviceIds } },
    select: { id: true, name: true },
  });
  const serviceName = (id: string) => services.find((s) => s.id === id)?.name ?? "Service";

  // The parent keeps the first line's service for legacy compatibility and
  // rolls up the estimate/parts across all lines.
  const first = lines[0];
  const totalEstimate = lines.reduce((s, l) => s + (l.vendorEstimate ?? 0), 0);
  const parentParts = lines
    .map((l) => (l.partsNeeded ? `${serviceName(l.serviceId)}: ${l.partsNeeded}` : null))
    .filter(Boolean)
    .join("\n") || d.partsNeeded || null;

  const record = await prisma.workOrderRequest.create({
    data: {
      poNumber,
      station: d.station as Station,
      vehicleId: d.vehicleId || null,
      vehicleOther: d.vehicleOther || null,
      odometer: d.odometer ?? null,
      serviceId: first.serviceId,
      partsNeeded: parentParts,
      requestedDate: d.requestedDate ? new Date(d.requestedDate) : null,
      expectedCompletion: d.expectedCompletion ? new Date(d.expectedCompletion) : null,
      comments: d.comments || null,
      photoUrl: d.photoUrl || null,
      serviceHours: first.serviceHours ?? null,
      vendorEstimate: totalEstimate || null,
      requesterEmail: d.requesterEmail || null,
      requestedById: auth.user.id,
      items: {
        create: lines.map((l) => ({
          serviceId: l.serviceId,
          title: serviceName(l.serviceId),
          partsNeeded: l.partsNeeded || null,
          vendorEstimate: l.vendorEstimate ?? null,
          serviceHours: l.serviceHours ?? null,
        })),
      },
    },
    include: {
      vehicle: true,
      service: true,
      requestedBy: { select: userSelect },
      reviewedBy: { select: userSelect },
      items: { include: { service: true } },
    },
  });

  // Create alert for all management users
  const vehicleLabel = record.vehicle
    ? `${record.vehicle.licensePlate} - ${record.vehicle.name}`
    : record.vehicleOther ?? "Unknown vehicle";
  const serviceSummary = lines.length > 1
    ? `${serviceName(first.serviceId)} +${lines.length - 1} more`
    : serviceName(first.serviceId);
  const alertMessage = `New WO Request ${poNumber}: ${serviceSummary} for ${vehicleLabel} at ${d.station} — requested by ${auth.user.name}`;

  await prisma.alert.create({
    data: {
      type: "MAINTENANCE_DUE",
      severity: "WARNING",
      message: alertMessage,
      vehicleId: d.vehicleId || null,
    },
  });

  await logActivity(auth.user, {
    action: "requested",
    entity: "WO Request",
    entityLabel: `${serviceName} (PO ${poNumber})`,
    station: d.station,
    detail: vehicleLabel,
  });

  return NextResponse.json(record, { status: 201 });
}
