import { NextResponse } from "next/server";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireManager, badRequest, stationWhere } from "@/lib/api";
import { logActivity } from "@/lib/activity";
import { FLEET_GROUPS } from "@/lib/constants";

const DATE = /^\d{4}-\d{2}-\d{2}$/;

const schema = z.object({
  doc: z.enum(["insurance", "dotInspection"]),
  newExpiry: z.string().regex(DATE, "Expiry date required"),
  renewedOn: z.string().regex(DATE).optional().nullable(),
  station: z.string().optional().nullable(),
  fleetGroup: z.enum(FLEET_GROUPS).optional().nullable(),
  note: z.string().max(500).optional().nullable(),
});

const DOC_LABEL = { insurance: "Insurance", dotInspection: "DOT Annual Inspection" } as const;

/** Renews one compliance document for every vehicle in the active fleet at
 *  once (optionally one station / fleet): insurance for all vehicles, the DOT
 *  annual inspection for trucks. Logs a single activity entry. */
export async function POST(req: Request) {
  const auth = await requireManager();
  if ("error" in auth) return auth.error;
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return badRequest(parsed.error.issues[0]?.message ?? "Invalid input");
  const { doc, newExpiry, renewedOn, station, fleetGroup, note } = parsed.data;

  const where: Prisma.VehicleWhereInput = {
    status: { not: "OUT_OF_SERVICE" },
    OR: [{ offboardStatus: null }, { offboardStatus: { notIn: ["IN_PROGRESS", "COMPLETED"] } }],
    AND: [stationWhere(auth.user) ?? {}, station ? { station: station as Prisma.VehicleWhereInput["station"] } : {}],
    ...(fleetGroup ? { fleetGroup } : {}),
    ...(doc === "dotInspection" ? { type: "TRUCK" } : {}),
  };

  const expiry = new Date(newExpiry + "T12:00:00Z");
  const data: Prisma.VehicleUpdateManyMutationInput =
    doc === "insurance"
      ? { insuranceExpiry: expiry }
      : { dotInspectionExpiry: expiry, ...(renewedOn ? { dotInspectionDate: new Date(renewedOn + "T12:00:00Z") } : {}) };

  const { count } = await prisma.vehicle.updateMany({ where, data });

  const scope = [station || "all stations", fleetGroup].filter(Boolean).join(", ");
  const parts = [
    `${DOC_LABEL[doc]} renewed for ${count} vehicle${count === 1 ? "" : "s"} (${scope})`,
    `new expiry ${newExpiry}`,
  ];
  if (renewedOn) parts.push(`renewed on ${renewedOn}`);
  if (note) parts.push(note);
  await logActivity(auth.user, {
    action: "renewed",
    entity: "Vehicle",
    entityLabel: `Fleet ${DOC_LABEL[doc]}`,
    station: station || null,
    detail: parts.join(" · "),
  });

  return NextResponse.json({ ok: true, count, newExpiry: expiry.toISOString() });
}
