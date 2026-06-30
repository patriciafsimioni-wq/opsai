import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireManager } from "@/lib/api";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireManager();
  if ("error" in auth) return auth.error;
  const { id } = await params;
  await prisma.fuelLog.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
