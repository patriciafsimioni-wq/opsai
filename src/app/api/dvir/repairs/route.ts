import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireManager, badRequest } from "@/lib/api";
import { logActivity } from "@/lib/activity";

// Inspection item columns on DvirReport that a repair can be recorded against.
const ITEMS = [
  "tires",
  "brakes",
  "lights",
  "mirrors",
  "windshield",
  "wipers",
  "horn",
  "seatbelts",
  "fluids",
  "bodyDamage",
  "exhaust",
  "steering",
  "suspension",
  "ac",
] as const;

const repairSchema = z.object({
  reportId: z.string().min(1),
  item: z.enum(ITEMS),
  description: z.string().min(1),
  cost: z.coerce.number().min(0).default(0),
  fixedAt: z.string().min(1),
  vendor: z.string().optional().nullable(),
  invoiceNumber: z.string().optional().nullable(),
  photos: z.string().optional().nullable(), // JSON array
});

/**
 * A DVIR alert clears once every failed item on the report has a repair, so the
 * report drops off the alerts tab only when the actual work is done.
 */
async function syncAlertResolved(reportId: string) {
  const report = await prisma.dvirReport.findUnique({
    where: { id: reportId },
    include: { repairs: { select: { item: true } } },
  });
  if (!report) return;
  const failed = ITEMS.filter((k) => (report as unknown as Record<string, string>)[k] === "FAIL");
  const repaired = new Set(report.repairs.map((r) => r.item));
  const allFixed = failed.length > 0 && failed.every((k) => repaired.has(k));
  if (report.alertResolved !== allFixed) {
    await prisma.dvirReport.update({
      where: { id: reportId },
      data: { alertResolved: allFixed },
    });
  }
}

export async function POST(req: Request) {
  const auth = await requireManager();
  if ("error" in auth) return auth.error;

  const body = await req.json().catch(() => null);
  const parsed = repairSchema.safeParse(body);
  if (!parsed.success) return badRequest(parsed.error.issues[0]?.message ?? "Invalid input");
  const d = parsed.data;

  const report = await prisma.dvirReport.findUnique({
    where: { id: d.reportId },
    include: { vehicle: { select: { name: true, dxNumber: true, station: true } } },
  });
  if (!report) return badRequest("Report not found");
  if ((report as unknown as Record<string, string>)[d.item] !== "FAIL") {
    return badRequest("That inspection item did not fail on this report");
  }

  const data = {
    description: d.description.trim(),
    cost: d.cost,
    fixedAt: new Date(d.fixedAt),
    vendor: d.vendor?.trim() || null,
    invoiceNumber: d.invoiceNumber?.trim() || null,
    photos: d.photos || null,
    recordedById: auth.user.id,
  };

  // Re-recording a repair for the same item replaces it, so a correction
  // doesn't create a duplicate.
  const repair = await prisma.dvirRepair.upsert({
    where: { reportId_item: { reportId: d.reportId, item: d.item } },
    create: { reportId: d.reportId, item: d.item, ...data },
    update: data,
  });

  await syncAlertResolved(d.reportId);

  await logActivity(auth.user, {
    action: "recorded DVIR repair",
    entity: "DvirReport",
    entityLabel: `${report.vehicle.dxNumber ?? report.vehicle.name} — ${d.item}`,
    station: report.vehicle.station,
    detail: `$${d.cost.toFixed(2)} — ${data.description}`,
  });

  return NextResponse.json(repair, { status: 201 });
}

export async function DELETE(req: Request) {
  const auth = await requireManager();
  if ("error" in auth) return auth.error;

  const id = new URL(req.url).searchParams.get("id");
  if (!id) return badRequest("Missing id");

  const repair = await prisma.dvirRepair.findUnique({ where: { id } });
  if (!repair) return badRequest("Repair not found");

  await prisma.dvirRepair.delete({ where: { id } });
  await syncAlertResolved(repair.reportId);

  return NextResponse.json({ ok: true });
}
