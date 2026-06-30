import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireApiUser, requireManager, badRequest } from "@/lib/api";

export async function GET() {
  const auth = await requireApiUser();
  if ("error" in auth) return auth.error;
  const services = await prisma.service.findMany({
    orderBy: [{ category: "asc" }, { name: "asc" }],
    include: { _count: { select: { workOrders: true } } },
  });
  return NextResponse.json(services);
}

const schema = z.object({
  name: z.string().min(1),
  category: z.enum(["PREVENTIVE", "CORRECTIVE"]),
  group: z.string().optional().nullable(),
  materialCost: z.coerce.number().min(0).optional(),
  laborCost: z.coerce.number().min(0).optional(),
  active: z.boolean().optional(),
});

export async function POST(req: Request) {
  const auth = await requireManager();
  if ("error" in auth) return auth.error;
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return badRequest(parsed.error.issues[0]?.message ?? "Invalid input");
  const d = parsed.data;
  const existing = await prisma.service.findUnique({ where: { name: d.name } });
  if (existing) return badRequest("A service with that name already exists");
  const service = await prisma.service.create({
    data: {
      name: d.name,
      category: d.category,
      group: d.group || null,
      materialCost: d.materialCost ?? 0,
      laborCost: d.laborCost ?? 0,
      active: d.active ?? true,
    },
  });
  return NextResponse.json(service, { status: 201 });
}
