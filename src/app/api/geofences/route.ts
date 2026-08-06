import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireApiUser, requireManager, badRequest } from "@/lib/api";

export async function GET() {
  const auth = await requireApiUser();
  if ("error" in auth) return auth.error;
  const fences = await prisma.geofence.findMany({ orderBy: { createdAt: "asc" } });
  return NextResponse.json(fences);
}

const schema = z.object({
  name: z.string().min(1),
  type: z.enum(["DEPOT", "CUSTOMER", "SERVICE", "RESTRICTED"]),
  centerLat: z.coerce.number(),
  centerLng: z.coerce.number(),
  radiusM: z.coerce.number().min(50),
  color: z.string().optional(),
});

export async function POST(req: Request) {
  const auth = await requireManager();
  if ("error" in auth) return auth.error;
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return badRequest(parsed.error.issues[0]?.message ?? "Invalid input");
  const d = parsed.data;
  const fence = await prisma.geofence.create({
    data: {
      name: d.name,
      type: d.type,
      centerLat: d.centerLat,
      centerLng: d.centerLng,
      radiusM: d.radiusM,
      color: d.color || "#2563eb",
    },
  });
  return NextResponse.json(fence, { status: 201 });
}
