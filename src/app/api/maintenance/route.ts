import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireApiUser, requireManager, badRequest, stationWhere, fleetGroupWhere } from "@/lib/api";
import { logActivity } from "@/lib/activity";
import { sendEmail, buildWorkOrderAssignmentEmail } from "@/lib/email";
import { STATIONS } from "@/lib/constants";
import type { Station } from "@prisma/client";

const ASSIGNEE_SELECT = { select: { id: true, name: true, email: true } } as const;
const ITEMS_INCLUDE = { include: { service: true } } as const;

export async function GET() {
  const auth = await requireApiUser();
  if ("error" in auth) return auth.error;
  // Vendors only see work orders assigned to them.
  if (auth.user.role === "VENDOR") {
    const mine = await prisma.workOrder.findMany({
      where: { assignedToId: auth.user.id },
      orderBy: { createdAt: "desc" },
      include: { vehicle: true, service: true, assignedTo: ASSIGNEE_SELECT, items: ITEMS_INCLUDE },
    });
    return NextResponse.json(mine);
  }
  const sw = stationWhere(auth.user);
  const fg = await fleetGroupWhere();
  const and: Record<string, unknown>[] = [];
  // Match either the linked vehicle's station or the work order's own station,
  // so services logged against "Other" (no vehicle) or a vehicle at another
  // station still surface for station-scoped users.
  if (sw) and.push({ OR: [{ vehicle: { is: sw } }, sw] });
  // Fleet grouping: tractor/trailer view shows only that fleet's work orders;
  // the regular view also keeps vehicle-less ("Other") work orders visible.
  if (fg === "TRACTOR_TRAILER") and.push({ vehicle: { fleetGroup: "TRACTOR_TRAILER" } });
  else if (fg === "REGULAR") and.push({ OR: [{ vehicle: { fleetGroup: "REGULAR" } }, { vehicleId: null }] });
  const orders = await prisma.workOrder.findMany({
    where: and.length ? { AND: and } : undefined,
    orderBy: { createdAt: "desc" },
    include: { vehicle: true, service: true, assignedTo: ASSIGNEE_SELECT, items: ITEMS_INCLUDE },
  });
  return NextResponse.json(orders);
}

const itemSchema = z.object({
  serviceId: z.string().optional().nullable(),
  title: z.string().min(1),
  description: z.string().optional().nullable(),
  materialCost: z.coerce.number().min(0).optional(),
  laborCost: z.coerce.number().min(0).optional(),
});

const schema = z.object({
  vehicleId: z.string().min(1).optional(),
  vehicleOther: z.string().optional().nullable(),
  serviceId: z.string().optional().nullable(),
  station: z.string().refine((s) => STATIONS.includes(s), "Invalid station"),
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
  assignedToId: z.string().optional().nullable(),
  // Optional multi-service line items. When present, the parent work order's
  // material/labor/cost are the rolled-up sums of these lines.
  items: z.array(itemSchema).optional(),
});

export async function POST(req: Request) {
  const auth = await requireManager();
  if ("error" in auth) return auth.error;
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return badRequest(parsed.error.issues[0]?.message ?? "Invalid input");
  const d = parsed.data;
  const hasItems = !!(d.items && d.items.length > 0);
  const laborHours = d.laborHours ?? 0;
  const laborRate = d.laborRate ?? 0;
  // With line items the parent totals are the sum of the lines; otherwise labor
  // is entered either as a flat "service cost" (the form) or hours × rate.
  const materialCost = hasItems
    ? d.items!.reduce((s, i) => s + (i.materialCost ?? 0), 0)
    : d.materialCost ?? 0;
  const laborCost = hasItems
    ? d.items!.reduce((s, i) => s + (i.laborCost ?? 0), 0)
    : d.serviceCost != null
      ? d.serviceCost
      : laborHours * laborRate;
  const completedAt = d.completedAt
    ? new Date(d.completedAt)
    : d.status === "COMPLETED"
      ? new Date()
      : null;
  const order = await prisma.workOrder.create({
    data: {
      vehicleId: d.vehicleId || null,
      vehicleOther: d.vehicleOther || null,
      serviceId: d.serviceId || (hasItems ? d.items![0].serviceId || null : null),
      station: d.station as Station,
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
      assignedToId: d.assignedToId || null,
      vin: d.vin || null,
      odometerAt: d.odometerAt ?? null,
      poNumber: d.poNumber || null,
      invoiceNumber: d.invoiceNumber || null,
      invoiceUrl: d.invoiceUrl || null,
      scheduledFor: d.scheduledFor ? new Date(d.scheduledFor) : null,
      completedAt,
      items: hasItems
        ? {
            create: d.items!.map((i) => ({
              serviceId: i.serviceId || null,
              title: i.title,
              description: i.description || null,
              materialCost: i.materialCost ?? 0,
              laborCost: i.laborCost ?? 0,
            })),
          }
        : undefined,
    },
  });

  await logActivity(auth.user, {
    action: "logged",
    entity: "Work Order",
    entityLabel: order.poNumber ? `${order.title} (PO ${order.poNumber})` : order.title,
    station: order.station,
    detail: order.status === "COMPLETED" ? "Completed" : undefined,
  });

  // Notify the assigned vendor with the full list of their open work orders.
  if (d.assignedToId) {
    void notifyAssignee(d.assignedToId, order.id).catch((e) =>
      console.error("[Maintenance] assignment email failed:", e),
    );
  }

  return NextResponse.json(order, { status: 201 });
}

async function notifyAssignee(assignedToId: string, newOrderId: string) {
  const assignee = await prisma.user.findUnique({ where: { id: assignedToId } });
  if (!assignee?.email) return;

  const openOrders = await prisma.workOrder.findMany({
    where: { assignedToId, status: { notIn: ["COMPLETED", "CANCELLED"] } },
    orderBy: { createdAt: "desc" },
    include: { vehicle: { select: { name: true } } },
  });
  const newOrder = openOrders.find((o) => o.id === newOrderId) ?? openOrders[0];
  if (!newOrder) return;

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://opsai-opal.vercel.app";
  const email = buildWorkOrderAssignmentEmail({
    vendorName: assignee.name,
    newItem: {
      title: newOrder.title,
      vehicle: newOrder.vehicle?.name ?? newOrder.vehicleOther ?? "—",
      station: newOrder.station,
    },
    openOrders: openOrders.map((o) => ({
      title: o.title,
      vehicle: o.vehicle?.name ?? o.vehicleOther ?? "—",
      station: o.station,
      poNumber: o.poNumber,
      status: o.status,
    })),
    appUrl,
  });
  await sendEmail({ to: assignee.email, ...email });
}
