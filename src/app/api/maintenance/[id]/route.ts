import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireManager, badRequest } from "@/lib/api";

const schema = z.object({
  status: z.enum(["OPEN", "SCHEDULED", "IN_PROGRESS", "COMPLETED", "CANCELLED"]).optional(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).optional(),
  materialCost: z.coerce.number().min(0).optional(),
  laborHours: z.coerce.number().min(0).optional(),
  laborRate: z.coerce.number().min(0).optional(),
  vendor: z.string().optional().nullable(),
});

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

  // Recompute costs if any cost component changed.
  let costFields: { materialCost?: number; laborHours?: number; laborRate?: number; laborCost?: number; cost?: number } = {};
  if (d.materialCost !== undefined || d.laborHours !== undefined || d.laborRate !== undefined) {
    const current = await prisma.workOrder.findUnique({ where: { id } });
    if (!current) return badRequest("Work order not found");
    const materialCost = d.materialCost ?? current.materialCost;
    const laborHours = d.laborHours ?? current.laborHours;
    const laborRate = d.laborRate ?? current.laborRate;
    const laborCost = laborHours * laborRate;
    costFields = { materialCost, laborHours, laborRate, laborCost, cost: materialCost + laborCost };
  }

  const order = await prisma.workOrder.update({
    where: { id },
    data: {
      status: d.status,
      priority: d.priority,
      ...costFields,
      vendor: d.vendor === undefined ? undefined : d.vendor || null,
      completedAt: d.status === "COMPLETED" ? new Date() : d.status ? null : undefined,
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
