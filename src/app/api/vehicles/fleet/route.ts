import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireManager, stationWhere } from "@/lib/api";
import { logActivity } from "@/lib/activity";

const schema = z.object({
  ids: z.array(z.string().min(1)).min(1),
  fleetGroup: z.enum(["REGULAR", "TRACTOR_TRAILER"]),
});

// Bulk-assigns vehicles to a fleet group (regular vs tractors & trailers).
// This only changes the grouping used for filtering views — no history is touched.
export async function POST(req: Request) {
  const auth = await requireManager();
  if ("error" in auth) return auth.error;

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }
  const { ids, fleetGroup } = parsed.data;

  // Only allow acting on vehicles the user can see (station scoping).
  const sw = stationWhere(auth.user);
  const result = await prisma.vehicle.updateMany({
    where: { id: { in: ids }, ...(sw ?? {}) },
    data: { fleetGroup },
  });

  await logActivity(auth.user, {
    action: "updated",
    entity: "Vehicle",
    entityLabel: `${result.count} vehicle(s) → ${fleetGroup === "TRACTOR_TRAILER" ? "Tractors & Trailers" : "Regular Fleet"}`,
  });

  return NextResponse.json({ updated: result.count });
}
