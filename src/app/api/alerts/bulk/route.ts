import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireApiUser, stationWhere, badRequest } from "@/lib/api";

const schema = z.object({
  action: z.enum(["read", "delete"]),
  ids: z.array(z.string()).min(1),
});

// Bulk mark-read / delete for the Alerts page "Select all" action. Scoped to
// the user's station so a station manager can only act on their own alerts.
export async function POST(req: Request) {
  const auth = await requireApiUser();
  if ("error" in auth) return auth.error;

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return badRequest("Invalid input");
  const { action, ids } = parsed.data;

  const sw = stationWhere(auth.user);
  const where = { id: { in: ids }, ...(sw ? { vehicle: { is: sw } } : {}) };

  if (action === "delete") {
    const res = await prisma.alert.deleteMany({ where });
    return NextResponse.json({ ok: true, count: res.count });
  }

  const res = await prisma.alert.updateMany({ where, data: { read: true } });
  return NextResponse.json({ ok: true, count: res.count });
}
