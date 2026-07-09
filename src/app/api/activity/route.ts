import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireApiUser } from "@/lib/api";
import { getUserStationFilter } from "@/lib/auth";

export async function GET() {
  const auth = await requireApiUser();
  if ("error" in auth) return auth.error;

  // Station-scoped users only see activity for their assigned station(s).
  const stations = getUserStationFilter(auth.user);
  const where: Record<string, unknown> =
    stations && stations.length > 0 ? { station: { in: stations } } : {};

  const rows = await prisma.activityLog
    .findMany({ where, orderBy: { createdAt: "desc" }, take: 1000 })
    .catch(() => []);

  return NextResponse.json(rows);
}
