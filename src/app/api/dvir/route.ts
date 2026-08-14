import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireApiUser, badRequest, stationWhere } from "@/lib/api";

const STATUS_VALUES = ["PASS", "FAIL", "NA"] as const;

const dvirSchema = z.object({
  vehicleId: z.string().min(1),
  odometer: z.coerce.number().min(0).optional(),
  tires: z.enum(STATUS_VALUES).default("PASS"),
  brakes: z.enum(STATUS_VALUES).default("PASS"),
  lights: z.enum(STATUS_VALUES).default("PASS"),
  mirrors: z.enum(STATUS_VALUES).default("PASS"),
  windshield: z.enum(STATUS_VALUES).default("PASS"),
  wipers: z.enum(STATUS_VALUES).default("PASS"),
  horn: z.enum(STATUS_VALUES).default("PASS"),
  seatbelts: z.enum(STATUS_VALUES).default("PASS"),
  fluids: z.enum(STATUS_VALUES).default("PASS"),
  bodyDamage: z.enum(STATUS_VALUES).default("PASS"),
  exhaust: z.enum(STATUS_VALUES).default("PASS"),
  steering: z.enum(STATUS_VALUES).default("PASS"),
  suspension: z.enum(STATUS_VALUES).default("PASS"),
  ac: z.enum(STATUS_VALUES).default("PASS"),
  notes: z.string().optional(),
  photos: z.string().optional(), // JSON array
});

export async function GET() {
  const auth = await requireApiUser();
  if ("error" in auth) return auth.error;

  const sw = stationWhere(auth.user);
  const reports = await prisma.dvirReport.findMany({
    where: sw ? { vehicle: { is: sw } } : undefined,
    orderBy: { createdAt: "desc" },
    take: 200,
    include: {
      vehicle: { select: { id: true, name: true, dxNumber: true, station: true } },
      submittedBy: { select: { id: true, name: true } },
      repairs: {
        orderBy: { fixedAt: "asc" },
        include: { recordedBy: { select: { id: true, name: true } } },
      },
    },
  });
  return NextResponse.json(reports);
}

export async function POST(req: Request) {
  const auth = await requireApiUser();
  if ("error" in auth) return auth.error;

  const body = await req.json().catch(() => null);
  const parsed = dvirSchema.safeParse(body);
  if (!parsed.success) return badRequest(parsed.error.issues[0]?.message ?? "Invalid input");

  const d = parsed.data;

  // Check for any failures
  const inspectionItems = [d.tires, d.brakes, d.lights, d.mirrors, d.windshield, d.wipers, d.horn, d.seatbelts, d.fluids, d.bodyDamage, d.exhaust, d.steering, d.suspension, d.ac];
  const hasFail = inspectionItems.includes("FAIL");
  const overallStatus = hasFail ? "FAIL" : "PASS";

  // Flag alert for critical issues (windshield, body damage, brakes)
  const hasAlert = d.windshield === "FAIL" || d.bodyDamage === "FAIL" || d.brakes === "FAIL";

  const report = await prisma.dvirReport.create({
    data: {
      vehicleId: d.vehicleId,
      submittedById: auth.user.id,
      odometer: d.odometer,
      tires: d.tires,
      brakes: d.brakes,
      lights: d.lights,
      mirrors: d.mirrors,
      windshield: d.windshield,
      wipers: d.wipers,
      horn: d.horn,
      seatbelts: d.seatbelts,
      fluids: d.fluids,
      bodyDamage: d.bodyDamage,
      exhaust: d.exhaust,
      steering: d.steering,
      suspension: d.suspension,
      ac: d.ac,
      overallStatus,
      notes: d.notes,
      photos: d.photos,
      hasAlert,
    },
  });

  return NextResponse.json(report, { status: 201 });
}
