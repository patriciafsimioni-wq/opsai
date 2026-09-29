import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireApiUser, badRequest } from "@/lib/api";
import { logActivity } from "@/lib/activity";
import { canManage } from "@/lib/auth";

const DOC_FIELD = {
  registration: "registrationExpiry",
  insurance: "insuranceExpiry",
  dotInspection: "dotInspectionExpiry",
} as const;

const DOC_LABEL = {
  registration: "Registration",
  insurance: "Insurance",
  dotInspection: "DOT Annual Inspection",
} as const;

const schema = z.object({
  doc: z.enum(["registration", "insurance", "dotInspection"]),
  newExpiry: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Expiry date required"),
  renewedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  cost: z.coerce.number().min(0).optional().nullable(),
  note: z.string().max(500).optional().nullable(),
});

/** Marks a compliance document as renewed: moves its expiry forward and logs
 *  the renewal (date, cost, note) in the activity feed. */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireApiUser();
  if ("error" in auth) return auth.error;
  if (!canManage(auth.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { id } = await params;
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return badRequest(parsed.error.issues[0]?.message ?? "Invalid input");
  const { doc, newExpiry, renewedOn, cost, note } = parsed.data;

  const existing = await prisma.vehicle.findUnique({
    where: { id },
    select: { id: true, name: true, station: true, registrationExpiry: true, insuranceExpiry: true, dotInspectionExpiry: true },
  });
  if (!existing) return NextResponse.json({ error: "Vehicle not found" }, { status: 404 });

  const field = DOC_FIELD[doc];
  const previous = existing[field];
  const expiry = new Date(newExpiry + "T12:00:00Z");
  const data: { registrationExpiry?: Date; insuranceExpiry?: Date; dotInspectionExpiry?: Date; dotInspectionDate?: Date } = {
    [field]: expiry,
  };
  if (doc === "dotInspection" && renewedOn) data.dotInspectionDate = new Date(renewedOn + "T12:00:00Z");

  const vehicle = await prisma.vehicle.update({ where: { id }, data });

  const fmt = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : "not set");
  const parts = [
    `${DOC_LABEL[doc]} renewed${renewedOn ? ` on ${renewedOn}` : ""}`,
    `expiry ${fmt(previous)} → ${newExpiry}`,
  ];
  if (cost != null) parts.push(`cost $${cost.toFixed(2)}`);
  if (note) parts.push(note);

  await logActivity(auth.user, {
    action: "renewed",
    entity: "Vehicle",
    entityLabel: vehicle.name,
    station: vehicle.station,
    detail: parts.join(" · "),
  });

  return NextResponse.json({
    ok: true,
    doc,
    previousExpiry: previous?.toISOString() ?? null,
    newExpiry: expiry.toISOString(),
  });
}
