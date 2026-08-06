import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireManager, badRequest } from "@/lib/api";

const patchSchema = z.object({
  name: z.string().min(1).optional(),
  type: z.enum(["DEPOT", "CUSTOMER", "SERVICE", "RESTRICTED"]).optional(),
  centerLat: z.coerce.number().optional(),
  centerLng: z.coerce.number().optional(),
  radiusM: z.coerce.number().min(50).optional(),
  color: z.string().optional(),
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireManager();
  if ("error" in auth) return auth.error;
  const { id } = await params;
  const body = await req.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return badRequest(parsed.error.issues[0]?.message ?? "Invalid input");
  const fence = await prisma.geofence.update({ where: { id }, data: parsed.data });
  return NextResponse.json(fence);
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireManager();
  if ("error" in auth) return auth.error;
  const { id } = await params;
  await prisma.geofence.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
