import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireManager, badRequest } from "@/lib/api";

const schema = z.object({
  status: z.enum(["OPEN", "SCHEDULED", "IN_PROGRESS", "COMPLETED", "CANCELLED"]).optional(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).optional(),
  cost: z.coerce.number().min(0).optional(),
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
  const order = await prisma.workOrder.update({
    where: { id },
    data: {
      ...d,
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
