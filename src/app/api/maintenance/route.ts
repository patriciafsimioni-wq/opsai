import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireApiUser, requireManager, badRequest, stationWhere } from "@/lib/api";

export async function GET() {
  const auth = await requireApiUser();
  if ("error" in auth) return auth.error;
  const sw = stationWhere(auth.user);
  const orders = await prisma.workOrder.findMany({
    where: sw ? { vehicle: { is: sw } } : undefined,
    orderBy: { createdAt: "desc" },
    include: { vehicle: true, service: true },
  });
  return NextResponse.json(orders);
}

const schema = z.object({
  vehicleId: z.string().min(1).optional(),
  vehicleOther: z.string().optional().nullable(),
  serviceId: z.string().optional().nullable(),
  station: z.enum(["AUS", "ACT", "IAH", "CLL", "BPT", "HRL", "LRD"]),
  type: z.enum(["SCHEDULED_SERVICE", "REPAIR", "INSPECTION", "TIRE", "OIL_CHANGE", "RECALL"]),
  title: z.string().min(1),
  description: z.string().optional().nullable(),
  status: z.enum(["OPEN", "SCHEDULED", "IN_PROGRESS", "COMPLETED", "CANCELLED"]),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]),
  materialCost: z.coerce.number().min(0).optional(),
  laborHours: z.coerce.number().min(0).optional(),
  laborRate: z.coerce.number().min(0).optional(),
  serviceCost: z.coerce.number().min(0).optional(),
  performedBy: z.string().optional().nullable(),
  vendor: z.string().optional().nullable(),
  vin: z.string().optional().nullable(),
  odometerAt: z.coerce.number().min(0).optional().nullable(),
  poNumber: z.string().optional().nullable(),
  invoiceNumber: z.string().optional().nullable(),
  invoiceUrl: z.string().optional().nullable(),
  scheduledFor: z.string().optional().nullable(),
  completedAt: z.string().optional().nullable(),
});

export async function POST(req: Request) {
  const auth = await requireManager();
  if ("error" in auth) return auth.error;
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return badRequest(parsed.error.issues[0]?.message ?? "Invalid input");
  const d = parsed.data;
  const materialCost = d.materialCost ?? 0;
  const laborHours = d.laborHours ?? 0;
  const laborRate = d.laborRate ?? 0;
  // Labor is entered either as a flat "service cost" (the form) or hours × rate.
  const laborCost = d.serviceCost != null ? d.serviceCost : laborHours * laborRate;
  const completedAt = d.completedAt
    ? new Date(d.completedAt)
    : d.status === "COMPLETED"
      ? new Date()
      : null;
  const order = await prisma.workOrder.create({
    data: {
      vehicleId: d.vehicleId || null,
      vehicleOther: d.vehicleOther || null,
      serviceId: d.serviceId || null,
      station: d.station,
      type: d.type,
      title: d.title,
      description: d.description || null,
      status: d.status,
      priority: d.priority,
      materialCost,
      laborHours,
      laborRate,
      laborCost,
      cost: materialCost + laborCost,
      performedBy: d.performedBy || null,
      vendor: d.vendor || null,
      vin: d.vin || null,
      odometerAt: d.odometerAt ?? null,
      poNumber: d.poNumber || null,
      invoiceNumber: d.invoiceNumber || null,
      invoiceUrl: d.invoiceUrl || null,
      scheduledFor: d.scheduledFor ? new Date(d.scheduledFor) : null,
      completedAt,
    },
  });
  return NextResponse.json(order, { status: 201 });
}
