import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireApiUser, requireManager, badRequest } from "@/lib/api";

export async function GET() {
  const auth = await requireApiUser();
  if ("error" in auth) return auth.error;
  const orders = await prisma.workOrder.findMany({
    orderBy: { createdAt: "desc" },
    include: { vehicle: true },
  });
  return NextResponse.json(orders);
}

const schema = z.object({
  vehicleId: z.string().min(1),
  type: z.enum(["SCHEDULED_SERVICE", "REPAIR", "INSPECTION", "TIRE", "OIL_CHANGE", "RECALL"]),
  title: z.string().min(1),
  description: z.string().optional().nullable(),
  status: z.enum(["OPEN", "SCHEDULED", "IN_PROGRESS", "COMPLETED", "CANCELLED"]),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]),
  cost: z.coerce.number().min(0).optional(),
  vendor: z.string().optional().nullable(),
  scheduledFor: z.string().optional().nullable(),
});

export async function POST(req: Request) {
  const auth = await requireManager();
  if ("error" in auth) return auth.error;
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return badRequest(parsed.error.issues[0]?.message ?? "Invalid input");
  const d = parsed.data;
  const order = await prisma.workOrder.create({
    data: {
      vehicleId: d.vehicleId,
      type: d.type,
      title: d.title,
      description: d.description || null,
      status: d.status,
      priority: d.priority,
      cost: d.cost ?? 0,
      vendor: d.vendor || null,
      scheduledFor: d.scheduledFor ? new Date(d.scheduledFor) : null,
      completedAt: d.status === "COMPLETED" ? new Date() : null,
    },
  });
  return NextResponse.json(order, { status: 201 });
}
