import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireManager, badRequest } from "@/lib/api";

const schema = z.object({
  name: z.string().min(1).optional(),
  category: z.enum(["PREVENTIVE", "CORRECTIVE"]).optional(),
  group: z.string().optional().nullable(),
  materialCost: z.coerce.number().min(0).optional(),
  laborCost: z.coerce.number().min(0).optional(),
  active: z.boolean().optional(),
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
  const service = await prisma.service.update({
    where: { id },
    data: {
      ...d,
      group: d.group === undefined ? undefined : d.group || null,
    },
  });
  return NextResponse.json(service);
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireManager();
  if ("error" in auth) return auth.error;
  const { id } = await params;
  await prisma.service.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
