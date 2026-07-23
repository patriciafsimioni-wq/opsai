import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireManager, badRequest } from "@/lib/api";
import { logActivity } from "@/lib/activity";

const schema = z.object({
  ids: z.array(z.string().min(1)).min(1),
  station: z.string().nullable(),
});

// Bulk-reassign the station on multiple fuel transactions at once.
export async function PATCH(req: Request) {
  const auth = await requireManager();
  if ("error" in auth) return auth.error;

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return badRequest(parsed.error.issues[0]?.message ?? "Invalid input");
  const { ids, station } = parsed.data;

  const result = await prisma.fuelLog.updateMany({
    where: { id: { in: ids } },
    data: { station: station || null },
  });

  await logActivity(auth.user, {
    action: "edited",
    entity: "Fuel Log",
    entityLabel: `${result.count} transaction${result.count === 1 ? "" : "s"}`,
    station: station || null,
    detail: `Station set to ${station || "Unassigned"}`,
  });

  return NextResponse.json({ ok: true, count: result.count });
}
