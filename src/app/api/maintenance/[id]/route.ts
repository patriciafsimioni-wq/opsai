import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireApiUser, requireManager, badRequest } from "@/lib/api";
import { canManage } from "@/lib/auth";

const schema = z.object({
  status: z.enum(["OPEN", "SCHEDULED", "IN_PROGRESS", "COMPLETED", "CANCELLED"]).optional(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).optional(),
  materialCost: z.coerce.number().min(0).optional(),
  laborHours: z.coerce.number().min(0).optional(),
  laborRate: z.coerce.number().min(0).optional(),
  serviceCost: z.coerce.number().min(0).optional(),
  vendor: z.string().optional().nullable(),
  // Full-edit fields (used by Log Service edit)
  vehicleId: z.string().optional().nullable(),
  vehicleOther: z.string().optional().nullable(),
  serviceId: z.string().optional().nullable(),
  station: z.enum(["AUS", "ACT", "IAH", "CLL", "BPT", "HRL", "LRD"]).optional(),
  type: z.enum(["SCHEDULED_SERVICE", "REPAIR", "INSPECTION", "TIRE", "OIL_CHANGE", "RECALL"]).optional(),
  title: z.string().min(1).optional(),
  description: z.string().optional().nullable(),
  vin: z.string().optional().nullable(),
  odometerAt: z.coerce.number().min(0).optional().nullable(),
  poNumber: z.string().optional().nullable(),
  invoiceNumber: z.string().optional().nullable(),
  invoiceUrl: z.string().optional().nullable(),
  performedBy: z.string().optional().nullable(),
  completedAt: z.string().optional().nullable(),
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireApiUser();
  if ("error" in auth) return auth.error;
  const { id } = await params;
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return badRequest(parsed.error.issues[0]?.message ?? "Invalid input");
  const d = parsed.data;

  const current = await prisma.workOrder.findUnique({ where: { id } });
  if (!current) return badRequest("Work order not found");

  // Managers can edit any work order; a vendor may only complete/update a
  // work order that is assigned to them.
  if (!canManage(auth.user.role)) {
    if (auth.user.role !== "VENDOR" || current.assignedToId !== auth.user.id) {
      return NextResponse.json(
        { error: "Forbidden — this work order is not assigned to you" },
        { status: 403 },
      );
    }
  }

  // Recompute costs if any cost component changed.
  let costFields: { materialCost?: number; laborHours?: number; laborRate?: number; laborCost?: number; cost?: number } = {};
  if (
    d.materialCost !== undefined ||
    d.laborHours !== undefined ||
    d.laborRate !== undefined ||
    d.serviceCost !== undefined
  ) {
    const materialCost = d.materialCost ?? current.materialCost;
    const laborHours = d.laborHours ?? current.laborHours;
    const laborRate = d.laborRate ?? current.laborRate;
    const laborCost = d.serviceCost != null ? d.serviceCost : laborHours * laborRate;
    costFields = { materialCost, laborHours, laborRate, laborCost, cost: materialCost + laborCost };
  }

  // Determine completedAt: honor an explicit date; otherwise fall back to
  // status-driven behavior (only when status changes).
  let completedAt: Date | null | undefined = undefined;
  if (d.completedAt !== undefined) {
    completedAt = d.completedAt ? new Date(d.completedAt) : null;
  } else if (d.status !== undefined) {
    completedAt = d.status === "COMPLETED" ? current.completedAt ?? new Date() : null;
  }

  const order = await prisma.workOrder.update({
    where: { id },
    data: {
      status: d.status,
      priority: d.priority,
      ...costFields,
      vendor: d.vendor === undefined ? undefined : d.vendor || null,
      vehicleId: d.vehicleId === undefined ? undefined : d.vehicleId || null,
      vehicleOther: d.vehicleOther === undefined ? undefined : d.vehicleOther || null,
      serviceId: d.serviceId === undefined ? undefined : d.serviceId || null,
      station: d.station,
      type: d.type,
      title: d.title,
      description: d.description === undefined ? undefined : d.description || null,
      vin: d.vin === undefined ? undefined : d.vin || null,
      odometerAt: d.odometerAt === undefined ? undefined : d.odometerAt ?? null,
      poNumber: d.poNumber === undefined ? undefined : d.poNumber || null,
      invoiceNumber: d.invoiceNumber === undefined ? undefined : d.invoiceNumber || null,
      invoiceUrl: d.invoiceUrl === undefined ? undefined : d.invoiceUrl || null,
      performedBy: d.performedBy === undefined ? undefined : d.performedBy || null,
      completedAt,
    },
  });
  return NextResponse.json(order);
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireManager();
  if ("error" in auth) return auth.error;
  const { id } = await params;
  await prisma.workOrder.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
