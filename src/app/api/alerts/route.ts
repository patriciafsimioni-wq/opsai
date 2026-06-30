import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireApiUser } from "@/lib/api";

export async function GET() {
  const auth = await requireApiUser();
  if ("error" in auth) return auth.error;
  const alerts = await prisma.alert.findMany({
    orderBy: { createdAt: "desc" },
    include: { vehicle: true, driver: true },
    take: 200,
  });
  return NextResponse.json(alerts);
}

// Mark all as read
export async function PATCH() {
  const auth = await requireApiUser();
  if ("error" in auth) return auth.error;
  await prisma.alert.updateMany({
    where: { read: false },
    data: { read: true },
  });
  return NextResponse.json({ ok: true });
}
