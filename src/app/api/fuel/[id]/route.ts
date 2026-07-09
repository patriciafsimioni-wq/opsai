import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireManager } from "@/lib/api";
import { logActivity } from "@/lib/activity";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireManager();
  if ("error" in auth) return auth.error;
  const { id } = await params;
  const existing = await prisma.fuelLog.findUnique({ where: { id }, select: { vehicle: { select: { name: true, station: true } } } });
  await prisma.fuelLog.delete({ where: { id } });
  await logActivity(auth.user, {
    action: "deleted",
    entity: "Fuel Log",
    entityLabel: existing?.vehicle?.name ?? id,
    station: existing?.vehicle?.station ?? null,
  });
  return NextResponse.json({ ok: true });
}
